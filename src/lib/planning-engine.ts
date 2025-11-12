// Motor de Planejamento - Lógica de Alocação e Cálculos

import { 
  Pedido, 
  Familia, 
  Configuracoes, 
  PrevisaoEntrega, 
  Alocacao, 
  OcupacaoDia,
  ProducaoDia,
  ItemProducaoDia
} from './types';

// Utilitários de Data
export function isDiaUtil(data: Date): boolean {
  const dia = data.getDay();
  return dia !== 0 && dia !== 6; // 0=domingo, 6=sábado
}

export function proximoDiaUtil(data: Date): Date {
  const proxima = new Date(data);
  proxima.setDate(proxima.getDate() + 1);
  while (!isDiaUtil(proxima)) {
    proxima.setDate(proxima.getDate() + 1);
  }
  return proxima;
}

export function formatarData(data: Date): string {
  return data.toISOString().split('T')[0];
}

export function parseData(dataStr: string): Date {
  return new Date(dataStr + 'T00:00:00');
}

export function formatarDataBR(dataStr: string): string {
  const data = parseData(dataStr);
  return data.toLocaleDateString('pt-BR');
}

export function getDiasUteisDoMes(ano: number, mes: number): string[] {
  const dias: string[] = [];
  const data = new Date(ano, mes, 1);
  
  while (data.getMonth() === mes) {
    if (isDiaUtil(data)) {
      dias.push(formatarData(data));
    }
    data.setDate(data.getDate() + 1);
  }
  
  return dias;
}

// Cálculo de Ocupação
export function calcularOcupacao(
  pedidos: Pedido[],
  dataInicio: string,
  dataFim: string
): OcupacaoDia[] {
  const ocupacao: { [data: string]: OcupacaoDia } = {};
  
  // Inicializar todas as datas
  let dataAtual = parseData(dataInicio);
  const fim = parseData(dataFim);
  
  while (dataAtual <= fim) {
    if (isDiaUtil(dataAtual)) {
      const dataStr = formatarData(dataAtual);
      ocupacao[dataStr] = { data: dataStr, torre: 0, puxador: 0 };
    }
    dataAtual.setDate(dataAtual.getDate() + 1);
  }
  
  // Somar alocações dos pedidos (exceto Entregue)
  pedidos.forEach(pedido => {
    if (pedido.status === 'Entregue') return;
    
    Object.entries(pedido.alocacoes).forEach(([data, qtd]) => {
      if (ocupacao[data]) {
        if (pedido.familia === 'Torre') {
          ocupacao[data].torre += qtd;
        } else {
          ocupacao[data].puxador += qtd;
        }
      }
    });
  });
  
  return Object.values(ocupacao).sort((a, b) => a.data.localeCompare(b.data));
}

// Alocação Automática
export function alocarPedido(
  pedido: Pedido,
  pedidosExistentes: Pedido[],
  config: Configuracoes,
  dataInicio?: Date
): { alocacoes: Alocacao; avisos: string[] } {
  const avisos: string[] = [];
  const alocacoes: Alocacao = {};
  
  if (pedido.somenteCorte) {
    return { alocacoes, avisos };
  }
  
  let quantidadeRestante = pedido.quantidade;
  let dataAtual = dataInicio || new Date();
  
  // Garantir que começamos em dia útil
  if (!isDiaUtil(dataAtual)) {
    dataAtual = proximoDiaUtil(dataAtual);
  }
  
  const mesInicial = dataAtual.getMonth();
  let mudouMes = false;
  
  while (quantidadeRestante > 0) {
    const dataStr = formatarData(dataAtual);
    
    // Verificar se mudou de mês
    if (dataAtual.getMonth() !== mesInicial && !mudouMes) {
      mudouMes = true;
      const nomeMes = dataAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      avisos.push(`Capacidade mensal esgotada (${pedido.familia}); continuação alocada em ${nomeMes.toUpperCase()}.`);
    }
    
    // Capacidade do dia
    const capacidadeDia = config.overrides[dataStr]?.[pedido.familia.toLowerCase() as 'torre' | 'puxador'] 
      || config.capacidadeDia[pedido.familia.toLowerCase() as 'torre' | 'puxador'];
    
    // Calcular ocupação atual do dia
    let ocupacaoAtual = 0;
    pedidosExistentes.forEach(p => {
      if (p.id !== pedido.id && p.status !== 'Entregue' && p.familia === pedido.familia) {
        ocupacaoAtual += p.alocacoes[dataStr] || 0;
      }
    });
    
    const capacidadeLivre = Math.max(0, capacidadeDia - ocupacaoAtual);
    
    if (capacidadeLivre > 0) {
      const alocar = Math.min(quantidadeRestante, capacidadeLivre);
      alocacoes[dataStr] = alocar;
      quantidadeRestante -= alocar;
      
      if (capacidadeLivre < pedido.quantidade && !avisos.some(a => a.includes(dataStr))) {
        avisos.push(`Capacidade diária atingida em ${formatarDataBR(dataStr)} (${pedido.familia}).`);
      }
    }
    
    dataAtual = proximoDiaUtil(dataAtual);
    
    // Proteção contra loop infinito
    if (dataAtual.getFullYear() > new Date().getFullYear() + 2) {
      avisos.push('Erro: não foi possível alocar toda a quantidade em prazo razoável.');
      break;
    }
  }
  
  return { alocacoes, avisos };
}

// Previsão de Entrega
export function preverEntrega(
  quantidade: number,
  familia: Familia,
  pedidosExistentes: Pedido[],
  config: Configuracoes
): PrevisaoEntrega {
  const pedidoTemp: Pedido = {
    id: 'temp',
    pedido: '',
    produto: '',
    familia,
    acabamento: 'Polido',
    quantidade,
    status: 'Não iniciado',
    prazo: '',
    somenteCorte: false,
    alocacoes: {},
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };
  
  const { alocacoes, avisos } = alocarPedido(pedidoTemp, pedidosExistentes, config);
  
  const datas = Object.keys(alocacoes).sort();
  const dataEstimada = datas.length > 0 ? datas[datas.length - 1] : null;
  
  return {
    dataEstimada,
    avisos,
    alocacoesSimuladas: alocacoes
  };
}

// Produção Dia-a-Dia - ORDENADO POR URGÊNCIA (prazo mais próximo primeiro)
export function gerarProducaoDiaria(
  pedidos: Pedido[],
  diasUteis: number
): ProducaoDia[] {
  const producao: { [data: string]: ItemProducaoDia[] } = {};
  
  // Filtrar pedidos não entregues
  const pedidosAtivos = pedidos.filter(p => p.status !== 'Entregue');
  
  // Coletar todas as alocações
  pedidosAtivos.forEach(pedido => {
    Object.entries(pedido.alocacoes).forEach(([data, qtd]) => {
      if (!producao[data]) {
        producao[data] = [];
      }
      
      producao[data].push({
        pedidoId: pedido.id,
        pedido: pedido.pedido,
        produto: pedido.produto,
        quantidade: qtd,
        familia: pedido.familia,
        prazo: pedido.prazo,
        status: pedido.status
      });
    });
  });
  
  // Pegar próximos N dias úteis
  let dataAtual = new Date();
  const datasUteis: string[] = [];
  
  while (datasUteis.length < diasUteis) {
    if (isDiaUtil(dataAtual)) {
      datasUteis.push(formatarData(dataAtual));
    }
    dataAtual.setDate(dataAtual.getDate() + 1);
  }
  
  // Montar resultado ORDENADO POR PRAZO (mais urgente primeiro)
  return datasUteis.map(data => {
    const items = producao[data] || [];
    
    // Ordenar por prazo: quanto mais próximo/atrasado, mais urgente
    items.sort((a, b) => {
      // Comparar prazos diretamente (formato YYYY-MM-DD)
      // Prazos menores (mais antigos) vêm primeiro = mais urgentes
      return a.prazo.localeCompare(b.prazo);
    });
    
    return {
      data,
      items
    };
  });
}

// Verificar prazo estourado
export function isPrazoEstourado(prazo: string, status: string): boolean {
  if (status === 'Entregue') return false;
  const hoje = formatarData(new Date());
  return prazo < hoje;
}

// Totais do mês
export function calcularTotaisMes(
  ano: number,
  mes: number,
  config: Configuracoes
): { torre: number; puxador: number; diasUteis: number } {
  const diasUteis = getDiasUteisDoMes(ano, mes);
  
  let torre = 0;
  let puxador = 0;
  
  diasUteis.forEach(data => {
    const override = config.overrides[data];
    torre += override?.torre ?? config.capacidadeDia.torre;
    puxador += override?.puxador ?? config.capacidadeDia.puxador;
  });
  
  return { torre, puxador, diasUteis: diasUteis.length };
}
