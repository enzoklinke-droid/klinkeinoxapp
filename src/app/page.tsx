'use client';

import { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  FileText,
  Settings,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Package
} from 'lucide-react';
import { 
  Pedido, 
  Familia, 
  Acabamento, 
  Status, 
  Configuracoes,
  ChecklistItem,
  ProducaoDia
} from '@/lib/types';
import {
  alocarPedido,
  preverEntrega,
  calcularOcupacao,
  gerarProducaoDiaria,
  isPrazoEstourado,
  formatarDataBR,
  formatarData,
  parseData,
  getDiasUteisDoMes,
  calcularTotaisMes,
  isDiaUtil
} from '@/lib/planning-engine';
import {
  carregarDados,
  salvarDados,
  atualizarPedido,
  removerPedido,
  atualizarConfiguracoes,
  atualizarChecklist,
  obterChecklist
} from '@/lib/storage';

export default function PlanejadorKlinke() {
  // Estados principais
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [config, setConfig] = useState<Configuracoes>({
    capacidadeDia: { torre: 100, puxador: 100 },
    overrides: {}
  });
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  
  // Estados do formulário
  const [formPedido, setFormPedido] = useState('');
  const [formProduto, setFormProduto] = useState('');
  const [formFamilia, setFormFamilia] = useState<Familia>('Torre');
  const [formAcabamento, setFormAcabamento] = useState<Acabamento>('Polido');
  const [formQuantidade, setFormQuantidade] = useState('');
  const [formPrazo, setFormPrazo] = useState('');
  const [formSomenteCorte, setFormSomenteCorte] = useState(false);
  const [previsao, setPrevisao] = useState<{ data: string | null; avisos: string[] }>({ data: null, avisos: [] });
  
  // Estados da interface
  const [abaAtiva, setAbaAtiva] = useState<'abertos' | 'concluidos'>('abertos');
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<Status | 'todos'>('todos');
  const [filtroFamilia, setFiltroFamilia] = useState<Familia | 'todos'>('todos');
  const [mesCalendario, setMesCalendario] = useState(new Date().getMonth());
  const [anoCalendario, setAnoCalendario] = useState(new Date().getFullYear());
  const [diasProducao, setDiasProducao] = useState(5);
  const [pedidoParaRemover, setPedidoParaRemover] = useState<string | null>(null);
  const [editandoCapacidade, setEditandoCapacidade] = useState(false);
  const [tempCapTorre, setTempCapTorre] = useState('100');
  const [tempCapPuxador, setTempCapPuxador] = useState('100');
  
  // Carregar dados ao montar
  useEffect(() => {
    const dados = carregarDados();
    setPedidos(dados.pedidos);
    setConfig(dados.configuracoes);
    setChecklists(dados.checklists);
    setTempCapTorre(dados.configuracoes.capacidadeDia.torre.toString());
    setTempCapPuxador(dados.configuracoes.capacidadeDia.puxador.toString());
  }, []);
  
  // Atualizar previsão em tempo real
  useEffect(() => {
    if (formQuantidade && parseInt(formQuantidade) > 0 && !formSomenteCorte) {
      const prev = preverEntrega(
        parseInt(formQuantidade),
        formFamilia,
        pedidos,
        config
      );
      setPrevisao({ data: prev.dataEstimada, avisos: prev.avisos });
    } else {
      setPrevisao({ data: null, avisos: [] });
    }
  }, [formQuantidade, formFamilia, formSomenteCorte, pedidos, config]);
  
  // Handlers
  const handleAdicionarPedido = () => {
    if (!formPedido.trim() || !formQuantidade || parseInt(formQuantidade) <= 0) {
      alert('Preencha o número do pedido e a quantidade.');
      return;
    }
    
    const novoPedido: Pedido = {
      id: Date.now().toString(),
      pedido: formPedido.trim(),
      produto: formProduto.trim(),
      familia: formFamilia,
      acabamento: formAcabamento,
      quantidade: parseInt(formQuantidade),
      status: 'Não iniciado',
      prazo: formPrazo || formatarData(new Date()),
      somenteCorte: formSomenteCorte,
      alocacoes: {},
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    
    // Alocar se não for somente corte
    if (!formSomenteCorte) {
      const { alocacoes, avisos } = alocarPedido(novoPedido, pedidos, config);
      novoPedido.alocacoes = alocacoes;
      
      if (avisos.length > 0) {
        alert(avisos.join('\n'));
      }
    }
    
    const novosPedidos = [...pedidos, novoPedido];
    setPedidos(novosPedidos);
    salvarDados({ pedidos: novosPedidos, configuracoes: config, checklists });
    
    // Limpar formulário
    setFormPedido('');
    setFormProduto('');
    setFormQuantidade('');
    setFormPrazo('');
    setFormSomenteCorte(false);
  };
  
  const handleAtualizarStatus = (id: string, novoStatus: Status) => {
    const pedidosAtualizados = pedidos.map(p => 
      p.id === id ? { ...p, status: novoStatus, atualizadoEm: new Date().toISOString() } : p
    );
    setPedidos(pedidosAtualizados);
    salvarDados({ pedidos: pedidosAtualizados, configuracoes: config, checklists });
  };
  
  const handleRemoverPedido = (id: string) => {
    const pedidosAtualizados = pedidos.filter(p => p.id !== id);
    const checklistsAtualizados = checklists.filter(c => c.pedidoId !== id);
    setPedidos(pedidosAtualizados);
    setChecklists(checklistsAtualizados);
    salvarDados({ pedidos: pedidosAtualizados, configuracoes: config, checklists: checklistsAtualizados });
    setPedidoParaRemover(null);
  };
  
  const handleAplicarPrazo = () => {
    if (previsao.data) {
      setFormPrazo(previsao.data);
    }
  };
  
  const handleSalvarCapacidade = () => {
    const novaConfig = {
      ...config,
      capacidadeDia: {
        torre: parseInt(tempCapTorre) || 100,
        puxador: parseInt(tempCapPuxador) || 100
      }
    };
    setConfig(novaConfig);
    salvarDados({ pedidos, configuracoes: novaConfig, checklists });
    setEditandoCapacidade(false);
    
    // Realocar todos os pedidos não "somente corte"
    const pedidosRealocados = pedidos.map(p => {
      if (p.somenteCorte || p.status === 'Entregue') return p;
      const { alocacoes } = alocarPedido(p, pedidos.filter(x => x.id !== p.id), novaConfig);
      return { ...p, alocacoes, atualizadoEm: new Date().toISOString() };
    });
    setPedidos(pedidosRealocados);
    salvarDados({ pedidos: pedidosRealocados, configuracoes: novaConfig, checklists });
  };
  
  const handleToggleChecklist = (pedidoId: string, data: string, campo: 'soldaTampa' | 'montagem') => {
    const checklistAtual = checklists.find(c => c.pedidoId === pedidoId && c.data === data) || {
      pedidoId,
      data,
      soldaTampa: false,
      montagem: false
    };
    
    const novoChecklist = {
      ...checklistAtual,
      [campo]: !checklistAtual[campo]
    };
    
    const checklistsAtualizados = checklists.filter(c => !(c.pedidoId === pedidoId && c.data === data));
    checklistsAtualizados.push(novoChecklist);
    setChecklists(checklistsAtualizados);
    salvarDados({ pedidos, configuracoes: config, checklists: checklistsAtualizados });
  };
  
  const handleImprimirDia = (data: string) => {
    const producaoDia = gerarProducaoDiaria(pedidos, 30).find(p => p.data === data);
    if (!producaoDia || producaoDia.items.length === 0) return;
    
    const conteudoHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Produção ${formatarDataBR(data)}</title>
        <style>
          @page { margin: 10mm; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          h1 { text-align: center; margin-bottom: 20px; font-size: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #333; padding: 8px; text-align: left; }
          th { background-color: #4f46e5; color: white; font-weight: bold; }
          .checkbox { width: 20px; height: 20px; border: 2px solid #333; display: inline-block; }
        </style>
      </head>
      <body>
        <h1>Produção do Dia - ${formatarDataBR(data)}</h1>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Pedido</th>
              <th>Produto</th>
              <th>Quantidade</th>
              <th>Solda Tampa</th>
              <th>Montagem</th>
            </tr>
          </thead>
          <tbody>
            ${producaoDia.items.map((item, idx) => {
              const checklist = checklists.find(c => c.pedidoId === item.pedidoId && c.data === data);
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td><strong>${item.pedido}</strong></td>
                  <td>${item.produto}</td>
                  <td>${item.quantidade}</td>
                  <td><span class="checkbox">${checklist?.soldaTampa ? '✓' : ''}</span></td>
                  <td><span class="checkbox">${checklist?.montagem ? '✓' : ''}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    const janela = window.open('', '_blank');
    if (janela) {
      janela.document.write(conteudoHTML);
      janela.document.close();
      janela.print();
    }
  };
  
  // Filtros
  const pedidosFiltrados = pedidos.filter(p => {
    // Filtro de aba
    if (abaAtiva === 'abertos' && (p.status === 'Concluído' || p.status === 'Entregue')) return false;
    if (abaAtiva === 'concluidos' && p.status !== 'Concluído' && p.status !== 'Entregue') return false;
    
    // Busca
    if (busca && !p.pedido.toLowerCase().includes(busca.toLowerCase()) && !p.produto.toLowerCase().includes(busca.toLowerCase())) {
      return false;
    }
    
    // Filtros
    if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false;
    if (filtroFamilia !== 'todos' && p.familia !== filtroFamilia) return false;
    
    return true;
  }).sort((a, b) => a.prazo.localeCompare(b.prazo));
  
  // Calendário
  const diasDoMes = getDiasUteisDoMes(anoCalendario, mesCalendario);
  const ocupacao = calcularOcupacao(pedidos, diasDoMes[0] || formatarData(new Date()), diasDoMes[diasDoMes.length - 1] || formatarData(new Date()));
  const totaisMes = calcularTotaisMes(anoCalendario, mesCalendario, config);
  
  // Produção dia-a-dia
  const producaoDiaria = gerarProducaoDiaria(pedidos, diasProducao);
  
  // Cores
  const coresFamilia = {
    Torre: 'bg-indigo-500',
    Puxador: 'bg-green-500'
  };
  
  const coresStatus: Record<Status, string> = {
    'Não iniciado': 'bg-gray-500',
    'Em andamento': 'bg-blue-500',
    'Concluído': 'bg-green-500',
    'Pulado': 'bg-violet-500',
    'Entregue': 'bg-teal-500'
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Cabeçalho */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center gap-4">
          <img 
            src="https://k6hrqrxuu8obbfwn.public.blob.vercel-storage.com/temp/a5a06ce4-4125-4099-b4fb-1b717ed2b501.jpg" 
            alt="KLINKE Logo" 
            className="h-12 w-auto"
          />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Planejador de Produção</h1>
            <p className="text-sm text-slate-600">Sistema de Corte e Alocação</p>
          </div>
        </div>
      </header>
      
      <div className="max-w-[1800px] mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Coluna Esquerda - Formulário e Pedidos */}
          <div className="col-span-4 space-y-6">
            {/* Incluir Pedido */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Incluir Pedido
              </h2>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Pedido *</label>
                  <input
                    type="text"
                    value={formPedido}
                    onChange={(e) => setFormPedido(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Número do pedido"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Produto</label>
                  <input
                    type="text"
                    value={formProduto}
                    onChange={(e) => setFormProduto(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Nome do produto"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Família</label>
                    <select
                      value={formFamilia}
                      onChange={(e) => setFormFamilia(e.target.value as Familia)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="Torre">Torre</option>
                      <option value="Puxador">Puxador</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Acabamento</label>
                    <select
                      value={formAcabamento}
                      onChange={(e) => setFormAcabamento(e.target.value as Acabamento)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="Polido">Polido</option>
                      <option value="Pintura">Pintura</option>
                      <option value="Escovado">Escovado</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade *</label>
                    <input
                      type="number"
                      value={formQuantidade}
                      onChange={(e) => setFormQuantidade(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="0"
                      min="1"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Prazo</label>
                    <input
                      type="date"
                      value={formPrazo}
                      onChange={(e) => setFormPrazo(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="somenteCorte"
                    checked={formSomenteCorte}
                    onChange={(e) => setFormSomenteCorte(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="somenteCorte" className="text-sm text-slate-700">
                    Somente Corte (não alocar capacidade)
                  </label>
                </div>
                
                {previsao.data && !formSomenteCorte && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                    <p className="text-sm text-indigo-900 font-medium mb-2">
                      Previsão de término: {formatarDataBR(previsao.data)}
                    </p>
                    <button
                      onClick={handleAplicarPrazo}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Aplicar ao prazo
                    </button>
                    {previsao.avisos.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {previsao.avisos.map((aviso, idx) => (
                          <p key={idx} className="text-xs text-amber-700 flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                            {aviso}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                <button
                  onClick={handleAdicionarPedido}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Adicionar Pedido
                </button>
              </div>
            </div>
            
            {/* Limites Diários */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-slate-600" />
                  Limites Diários
                </h2>
                {!editandoCapacidade && (
                  <button
                    onClick={() => setEditandoCapacidade(true)}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Editar
                  </button>
                )}
              </div>
              
              {editandoCapacidade ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Torre</label>
                    <input
                      type="number"
                      value={tempCapTorre}
                      onChange={(e) => setTempCapTorre(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Puxador</label>
                    <input
                      type="number"
                      value={tempCapPuxador}
                      onChange={(e) => setTempCapPuxador(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      min="1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSalvarCapacidade}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors"
                    >
                      Salvar
                    </button>
                    <button
                      onClick={() => {
                        setEditandoCapacidade(false);
                        setTempCapTorre(config.capacidadeDia.torre.toString());
                        setTempCapPuxador(config.capacidadeDia.puxador.toString());
                      }}
                      className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Torre</span>
                    <span className="text-lg font-bold text-indigo-600">{config.capacidadeDia.torre}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Puxador</span>
                    <span className="text-lg font-bold text-green-600">{config.capacidadeDia.puxador}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Lista de Pedidos */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200">
              <div className="p-6 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-slate-600" />
                  Pedidos
                </h2>
                
                {/* Abas */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setAbaAtiva('abertos')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                      abaAtiva === 'abertos'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Abertos
                  </button>
                  <button
                    onClick={() => setAbaAtiva('concluidos')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                      abaAtiva === 'concluidos'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Concluídos
                  </button>
                </div>
                
                {/* Busca */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar pedido ou produto..."
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                
                {/* Filtros */}
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value as Status | 'todos')}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="todos">Todos os status</option>
                    <option value="Não iniciado">Não iniciado</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Pulado">Pulado</option>
                    <option value="Entregue">Entregue</option>
                  </select>
                  
                  <select
                    value={filtroFamilia}
                    onChange={(e) => setFiltroFamilia(e.target.value as Familia | 'todos')}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="todos">Todas as famílias</option>
                    <option value="Torre">Torre</option>
                    <option value="Puxador">Puxador</option>
                  </select>
                </div>
              </div>
              
              {/* Cartões de Pedidos */}
              <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                {pedidosFiltrados.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">Nenhum pedido encontrado</p>
                ) : (
                  pedidosFiltrados.map(pedido => {
                    const prazoEstourado = isPrazoEstourado(pedido.prazo, pedido.status);
                    const ultimaAlocacao = Object.keys(pedido.alocacoes).sort().pop();
                    
                    return (
                      <div
                        key={pedido.id}
                        className={`border-2 rounded-lg p-4 transition-all ${
                          prazoEstourado ? 'border-red-500 bg-red-50' : 'border-slate-200 bg-white hover:border-indigo-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900">{pedido.pedido}</h3>
                            {pedido.produto && (
                              <p className="text-sm text-slate-600">{pedido.produto}</p>
                            )}
                          </div>
                          <button
                            onClick={() => setPedidoParaRemover(pedido.id)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${coresFamilia[pedido.familia]}`}>
                            {pedido.familia}
                          </span>
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                            {pedido.acabamento}
                          </span>
                          {pedido.somenteCorte && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              Somente Corte
                            </span>
                          )}
                          {prazoEstourado && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-500 text-white">
                              Prazo estourado
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <span className="text-slate-600">Quantidade:</span>
                            <span className="ml-1 font-semibold text-slate-900">{pedido.quantidade}</span>
                          </div>
                          <div>
                            <span className="text-slate-600">Prazo:</span>
                            <span className="ml-1 font-semibold text-slate-900">{formatarDataBR(pedido.prazo)}</span>
                          </div>
                        </div>
                        
                        {ultimaAlocacao && !pedido.somenteCorte && (
                          <div className="text-sm mb-3">
                            <span className="text-slate-600">Previsto terminar:</span>
                            <span className="ml-1 font-semibold text-indigo-600">{formatarDataBR(ultimaAlocacao)}</span>
                          </div>
                        )}
                        
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Status</label>
                          <select
                            value={pedido.status}
                            onChange={(e) => handleAtualizarStatus(pedido.id, e.target.value as Status)}
                            className={`w-full px-3 py-2 rounded-lg text-white font-medium text-sm ${coresStatus[pedido.status]}`}
                          >
                            <option value="Não iniciado">Não iniciado</option>
                            <option value="Em andamento">Em andamento</option>
                            <option value="Concluído">Concluído</option>
                            <option value="Pulado">Pulado</option>
                            <option value="Entregue">Entregue</option>
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          
          {/* Coluna Direita - Calendário e Produção */}
          <div className="col-span-8 space-y-6">
            {/* Calendário */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-slate-600" />
                  Calendário de Capacidade
                </h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (mesCalendario === 0) {
                        setMesCalendario(11);
                        setAnoCalendario(anoCalendario - 1);
                      } else {
                        setMesCalendario(mesCalendario - 1);
                      }
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <span className="text-lg font-semibold text-slate-900 min-w-[180px] text-center">
                    {new Date(anoCalendario, mesCalendario).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => {
                      if (mesCalendario === 11) {
                        setMesCalendario(0);
                        setAnoCalendario(anoCalendario + 1);
                      } else {
                        setMesCalendario(mesCalendario + 1);
                      }
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>
              
              {/* Totais do Mês */}
              <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-1">Dias Úteis</p>
                  <p className="text-2xl font-bold text-slate-900">{totaisMes.diasUteis}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-1">Capacidade Torre</p>
                  <p className="text-2xl font-bold text-indigo-600">{totaisMes.torre}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-1">Capacidade Puxador</p>
                  <p className="text-2xl font-bold text-green-600">{totaisMes.puxador}</p>
                </div>
              </div>
              
              {/* Grid do Calendário */}
              <div className="grid grid-cols-7 gap-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                  <div key={dia} className="text-center text-sm font-semibold text-slate-600 py-2">
                    {dia}
                  </div>
                ))}
                
                {(() => {
                  const primeiroDia = new Date(anoCalendario, mesCalendario, 1).getDay();
                  const diasNoMes = new Date(anoCalendario, mesCalendario + 1, 0).getDate();
                  const dias = [];
                  
                  // Espaços vazios antes do primeiro dia
                  for (let i = 0; i < primeiroDia; i++) {
                    dias.push(<div key={`empty-${i}`} className="aspect-square" />);
                  }
                  
                  // Dias do mês
                  for (let dia = 1; dia <= diasNoMes; dia++) {
                    const data = new Date(anoCalendario, mesCalendario, dia);
                    const dataStr = formatarData(data);
                    const diaUtil = isDiaUtil(data);
                    const ocupacaoDia = ocupacao.find(o => o.data === dataStr);
                    
                    const capTorre = config.overrides[dataStr]?.torre ?? config.capacidadeDia.torre;
                    const capPuxador = config.overrides[dataStr]?.puxador ?? config.capacidadeDia.puxador;
                    
                    const percTorre = diaUtil && capTorre > 0 ? Math.min(100, ((ocupacaoDia?.torre || 0) / capTorre) * 100) : 0;
                    const percPuxador = diaUtil && capPuxador > 0 ? Math.min(100, ((ocupacaoDia?.puxador || 0) / capPuxador) * 100) : 0;
                    
                    const excessoTorre = diaUtil && ocupacaoDia && ocupacaoDia.torre > capTorre;
                    const excessoPuxador = diaUtil && ocupacaoDia && ocupacaoDia.puxador > capPuxador;
                    
                    // Pedidos do dia
                    const pedidosDoDia = pedidos.filter(p => 
                      p.status !== 'Entregue' && p.alocacoes[dataStr] && p.alocacoes[dataStr] > 0
                    );
                    
                    dias.push(
                      <div
                        key={dia}
                        className={`aspect-square border rounded-lg p-2 ${
                          diaUtil ? 'bg-white border-slate-200' : 'bg-slate-100 border-slate-200'
                        }`}
                      >
                        <div className="text-sm font-semibold text-slate-900 mb-1">{dia}</div>
                        
                        {diaUtil && (
                          <>
                            {/* Barra Torre */}
                            <div className="mb-1">
                              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${excessoTorre ? 'bg-red-500' : 'bg-indigo-500'}`}
                                  style={{ width: `${percTorre}%` }}
                                />
                              </div>
                            </div>
                            
                            {/* Barra Puxador */}
                            <div className="mb-2">
                              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${excessoPuxador ? 'bg-red-500' : 'bg-green-500'}`}
                                  style={{ width: `${percPuxador}%` }}
                                />
                              </div>
                            </div>
                            
                            {/* Mini-lista de pedidos */}
                            {pedidosDoDia.length > 0 && (
                              <div className="space-y-0.5">
                                {pedidosDoDia.slice(0, 2).map(p => (
                                  <div key={p.id} className="text-[10px] text-slate-600 truncate">
                                    {p.pedido} · {p.produto || 'Sem nome'} · {p.alocacoes[dataStr]}
                                  </div>
                                ))}
                                {pedidosDoDia.length > 2 && (
                                  <div className="text-[10px] text-slate-500">
                                    +{pedidosDoDia.length - 2} mais
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  }
                  
                  return dias;
                })()}
              </div>
              
              {/* Legenda */}
              <div className="mt-4 flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-indigo-500 rounded" />
                  <span className="text-slate-600">Torre</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded" />
                  <span className="text-slate-600">Puxador</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded" />
                  <span className="text-slate-600">Excesso</span>
                </div>
              </div>
            </div>
            
            {/* Produção Dia-a-Dia */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-600" />
                  Produção Dia-a-Dia
                </h2>
                <select
                  value={diasProducao}
                  onChange={(e) => setDiasProducao(parseInt(e.target.value))}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="3">3 dias</option>
                  <option value="5">5 dias</option>
                  <option value="7">7 dias</option>
                  <option value="10">10 dias</option>
                  <option value="15">15 dias</option>
                </select>
              </div>
              
              <div className="space-y-4">
                {producaoDiaria.map(dia => {
                  if (dia.items.length === 0) return null;
                  
                  return (
                    <div key={dia.data} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-slate-900">
                          {formatarDataBR(dia.data)}
                        </h3>
                        <button
                          onClick={() => handleImprimirDia(dia.data)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          PDF
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        {dia.items.map(item => {
                          const checklist = checklists.find(c => c.pedidoId === item.pedidoId && c.data === dia.data);
                          const prazoEstourado = isPrazoEstourado(item.prazo, item.status);
                          
                          return (
                            <div
                              key={`${item.pedidoId}-${dia.data}`}
                              className={`flex items-center gap-3 p-3 rounded-lg border ${
                                prazoEstourado ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-slate-900">{item.pedido}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${coresFamilia[item.familia]}`}>
                                    {item.familia}
                                  </span>
                                  {prazoEstourado && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white">
                                      Atrasado
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600">{item.produto}</p>
                                <p className="text-sm font-semibold text-slate-900 mt-1">
                                  Quantidade: {item.quantidade}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleToggleChecklist(item.pedidoId, dia.data, 'soldaTampa')}
                                  className={`w-8 h-8 border-2 rounded flex items-center justify-center transition-colors ${
                                    checklist?.soldaTampa
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : 'border-slate-300 hover:border-green-500'
                                  }`}
                                  title="Solda Tampa"
                                >
                                  {checklist?.soldaTampa && <CheckCircle2 className="w-5 h-5" />}
                                </button>
                                
                                <button
                                  onClick={() => handleToggleChecklist(item.pedidoId, dia.data, 'montagem')}
                                  className={`w-8 h-8 border-2 rounded flex items-center justify-center transition-colors ${
                                    checklist?.montagem
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : 'border-slate-300 hover:border-green-500'
                                  }`}
                                  title="Montagem"
                                >
                                  {checklist?.montagem && <CheckCircle2 className="w-5 h-5" />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                
                {producaoDiaria.every(d => d.items.length === 0) && (
                  <p className="text-center text-slate-500 py-8">Nenhuma produção programada</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de Confirmação de Remoção */}
      {pedidoParaRemover && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Confirmar Remoção</h3>
            </div>
            
            <p className="text-slate-600 mb-6">
              Remover este pedido? Esta ação não pode ser desfeita.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => handleRemoverPedido(pedidoParaRemover)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                Remover
              </button>
              <button
                onClick={() => setPedidoParaRemover(null)}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2.5 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
