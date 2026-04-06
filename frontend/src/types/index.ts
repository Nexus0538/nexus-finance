export type Page = 
  | 'dashboard' 
  | 'agent' 
  | 'defi' 
  | 'bridge' 
  | 'rwa' 
  | 'scanner' 
  | 'portfolio' 
  | 'alerts' 
  | 'pitch'
  | 'txhistory'
  | 'agentpolicy'
  | 'rwainvestor'
  | 'settings'
  | 'livetx';

export type SimMode = 'SIM' | 'LIVE';


export interface RWAAsset {
  id: string;
  name: string;
  type: string;
  value: number;
  apr: number;
  score: number;
  funded: number;
  color: string;
}

export interface PortfolioItem {
  name: string;
  pct: number;
  val: number;
  color: string;
}

export interface Transaction {
  id: string;
  type: 'pay' | 'yield' | 'mint' | 'bridge';
  desc: string;
  amt: string;
  icon: string;
  timestamp: string;
  hash: string;
}

export interface MarketSignal {
  icon: string;
  title: string;
  desc: string;
  type: 'info' | 'warn' | 'success';
}
