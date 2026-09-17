/** Block explorer URL builders for Robinhood Chain testnet. */

export function addressUrl(explorerBase: string, address: string): string {
  return `${explorerBase}/address/${address}`;
}

export function blockUrl(explorerBase: string, block: number): string {
  return `${explorerBase}/block/${block}`;
}
