import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { STUDIONET_CHAIN_ID, STUDIONET_RPC } from "./network";

/** Create an unsigned read-only client for public contract reads */
export function createReadClient() {
  return createClient({
    chain: studionet,
    // No account or provider needed for reads
  });
}

/** Create a write client with the user's EIP-1193 wallet */
export function createWriteClient(walletAddress: `0x${string}`) {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No EIP-1193 provider found");
  }
  return createClient({
    chain: studionet,
    account: walletAddress,
    provider: window.ethereum,
  });
}

/** Read contract state (view call) */
export async function readContract<T>(
  contractAddress: `0x${string}`,
  method: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[] = []
): Promise<T> {
  const client = createReadClient();
  const result = await client.readContract({
    address: contractAddress,
    functionName: method,
    args,
  });
  return result as T;
}

/** Validate chain before write */
export async function validateChain(): Promise<void> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No wallet found");
  }
  const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
  const chainId = parseInt(chainIdHex as string, 16);
  if (chainId !== STUDIONET_CHAIN_ID) {
    throw new Error(`Wrong network. Expected chain ${STUDIONET_CHAIN_ID}, got ${chainId}`);
  }
}

/** Request wallet to switch to Studionet */
export async function switchToStudionet(): Promise<void> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No wallet found");
  }
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${STUDIONET_CHAIN_ID.toString(16)}` }],
    });
  } catch (err: unknown) {
    // Chain not added yet
    if ((err as { code?: number }).code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${STUDIONET_CHAIN_ID.toString(16)}`,
            chainName: "GenLayer Studionet",
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            rpcUrls: [STUDIONET_RPC],
            blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}
