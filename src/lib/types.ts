// Tipos do Sistema de Planejamento KLINKE

export type Familia = 'Torre' | 'Puxador';
export type Acabamento = 'Polido' | 'Pintura' | 'Escovado';
export type Status = 'Não iniciado' | 'Em andamento' | 'Concluído' | 'Pulado' | 'Entregue';

export interface Alocacao {
  [data: string]: number; // ISO date string -> quantidade
}

export interface Pedido {
  id: string;
  pedido: string;
  produto: string;
  familia: Familia;
  acabamento: Acabamento;
  quantidade: number;
  status: Status;
  prazo: string; // ISO date string
  somenteCorte: boolean;
  alocacoes: Alocacao;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CapacidadeDia {
  torre: number;
  puxador: number;
}

export interface CapacidadeOverride {
  [data: string]: CapacidadeDia; // ISO date string -> capacidade
}

export interface Configuracoes {
  capacidadeDia: CapacidadeDia;
  overrides: CapacidadeOverride;
}

export interface ChecklistItem {
  pedidoId: string;
  data: string; // ISO date string
  soldaTampa: boolean;
  montagem: boolean;
}

export interface DadosApp {
  pedidos: Pedido[];
  configuracoes: Configuracoes;
  checklists: ChecklistItem[];
}

export interface PrevisaoEntrega {
  dataEstimada: string | null;
  avisos: string[];
  alocacoesSimuladas: Alocacao;
}

export interface OcupacaoDia {
  data: string;
  torre: number;
  puxador: number;
}

export interface ItemProducaoDia {
  pedidoId: string;
  pedido: string;
  produto: string;
  quantidade: number;
  familia: Familia;
  prazo: string;
  status: Status;
}

export interface ProducaoDia {
  data: string;
  items: ItemProducaoDia[];
}
