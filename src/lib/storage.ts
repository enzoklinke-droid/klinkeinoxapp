// Persistência Local com localStorage

import { DadosApp, Pedido, Configuracoes, ChecklistItem } from './types';

const STORAGE_KEY = 'klinke-planejamento-v1';

const DADOS_INICIAIS: DadosApp = {
  pedidos: [],
  configuracoes: {
    capacidadeDia: {
      torre: 100,
      puxador: 100
    },
    overrides: {}
  },
  checklists: []
};

export function carregarDados(): DadosApp {
  if (typeof window === 'undefined') return DADOS_INICIAIS;
  
  try {
    const dados = localStorage.getItem(STORAGE_KEY);
    if (!dados) return DADOS_INICIAIS;
    
    return JSON.parse(dados);
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    return DADOS_INICIAIS;
  }
}

export function salvarDados(dados: DadosApp): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
  }
}

export function adicionarPedido(pedido: Pedido): void {
  const dados = carregarDados();
  dados.pedidos.push(pedido);
  salvarDados(dados);
}

export function atualizarPedido(id: string, pedidoAtualizado: Partial<Pedido>): void {
  const dados = carregarDados();
  const index = dados.pedidos.findIndex(p => p.id === id);
  
  if (index !== -1) {
    dados.pedidos[index] = {
      ...dados.pedidos[index],
      ...pedidoAtualizado,
      atualizadoEm: new Date().toISOString()
    };
    salvarDados(dados);
  }
}

export function removerPedido(id: string): void {
  const dados = carregarDados();
  dados.pedidos = dados.pedidos.filter(p => p.id !== id);
  dados.checklists = dados.checklists.filter(c => c.pedidoId !== id);
  salvarDados(dados);
}

export function atualizarConfiguracoes(config: Configuracoes): void {
  const dados = carregarDados();
  dados.configuracoes = config;
  salvarDados(dados);
}

export function atualizarChecklist(item: ChecklistItem): void {
  const dados = carregarDados();
  const index = dados.checklists.findIndex(
    c => c.pedidoId === item.pedidoId && c.data === item.data
  );
  
  if (index !== -1) {
    dados.checklists[index] = item;
  } else {
    dados.checklists.push(item);
  }
  
  salvarDados(dados);
}

export function obterChecklist(pedidoId: string, data: string): ChecklistItem | undefined {
  const dados = carregarDados();
  return dados.checklists.find(c => c.pedidoId === pedidoId && c.data === data);
}
