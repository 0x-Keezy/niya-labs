// Four.meme launcher wired to Niya Labs' own on-chain identity.
//
// The three hardcoded addresses below (TokenManager2, AgentIdentifier,
// EIP8004 Registry) are PUBLIC on-chain contracts — safe to commit, but
// tied to our deployment. If you fork and run under a different brand,
// replace AGENT_IDENTIFIER_ADDRESS with your own EIP-8004 registration.
// See docs/PUBLIC_CONTRACTS.md for the full list + fork guidance.

import path from 'path';
import fs from 'fs';
import { ethers } from 'ethers';

const FOUR_MEME_API = 'https://four.meme/meme-api/v1';
const BSC_RPC = 'https://bsc-dataseed.binance.org/';

const TOKEN_MANAGER2_ADDRESS = '0x5c952063c7fc8610FFDB798152D69F0B9550762b';
const AGENT_IDENTIFIER_ADDRESS = '0x09B44A633de9F9EBF6FB9Bdd5b5629d3DD2cef13';
const EIP8004_IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
const REGISTRATION_TYPE = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';

const AGENT_IDENTIFIER_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'wallet', type: 'address' }],
    name: 'isAgent',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nftCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const EIP8004_ABI = [
  {
    inputs: [{ internalType: 'string', name: 'agentURI', type: 'string' }],
    name: 'register',
    outputs: [{ internalType: 'uint256', name: 'agentId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const TOKEN_MANAGER2_ABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'createArg', type: 'bytes' },
      { internalType: 'bytes', name: 'sign', type: 'bytes' },
    ],
    name: 'createToken',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
];

export interface LaunchConfig {
  name: string;
  shortName: string;
  desc: string;
  label: string;
  webUrl: string;
  twitterUrl: string;
  feePlan: boolean;
  taxConfig: {
    feeRate: number;
    recipientRate: number;
    burnRate: number;
    divideRate: number;
    liquidityRate: number;
    minSharing: number;
  };
}

export const LAUNCH_CONFIG: LaunchConfig = {
  name: 'Niya Agent',
  shortName: 'NIYA',
  desc: 'Niya Agent is an AI companion on BNB Chain. Your candy-loving friend in crypto. Powered by DGrid AI Gateway on BNB Chain.',
  label: 'AI',
  webUrl: 'https://niyaagent.com',
  twitterUrl: 'https://x.com/NiyaAgent',
  feePlan: false,
  taxConfig: {
    feeRate: 3,
    recipientRate: 80,
    burnRate: 0,
    divideRate: 0,
    liquidityRate: 20,
    minSharing: 100000,
  },
};

function toHex(value: string): string {
  if (value.startsWith('0x')) return value;
  if (/^[0-9a-fA-F]+$/.test(value)) return '0x' + value;
  const buf = Buffer.from(value, 'base64');
  return '0x' + buf.toString('hex');
}

export interface AgentVerificationResult {
  isAgent: boolean;
  walletAddress: string;
  nftCount?: number;
  error?: string;
}

export async function verifyAgentWallet(walletAddress: string): Promise<AgentVerificationResult> {
  try {
    const provider = new ethers.JsonRpcProvider(BSC_RPC);
    const contract = new ethers.Contract(AGENT_IDENTIFIER_ADDRESS, AGENT_IDENTIFIER_ABI, provider);
    const [isAgent, nftCount] = await Promise.all([
      contract.isAgent(walletAddress),
      contract.nftCount(),
    ]);
    return {
      isAgent: Boolean(isAgent),
      walletAddress,
      nftCount: Number(nftCount),
    };
  } catch (err: any) {
    return {
      isAgent: false,
      walletAddress,
      error: err.message || 'Failed to check agent status',
    };
  }
}

export interface EIP8004RegisterResult {
  txHash: string;
  agentId?: number;
  agentURI: string;
}

export async function registerEIP8004Agent(
  privateKey: string,
  name: string,
  imageUrl: string,
  description: string
): Promise<EIP8004RegisterResult> {
  const payload = {
    type: REGISTRATION_TYPE,
    name: name || 'Niya',
    description: description || 'Niya is an AI companion on BNB Chain. Candy-loving crypto friend.',
    image: imageUrl || '',
    active: true,
    supportedTrust: [''],
  };
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json, 'utf8').toString('base64');
  const agentURI = `data:application/json;base64,${base64}`;

  const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const provider = new ethers.JsonRpcProvider(BSC_RPC);
  const wallet = new ethers.Wallet(normalizedKey, provider);

  const contract = new ethers.Contract(EIP8004_IDENTITY_REGISTRY, EIP8004_ABI, wallet);
  const tx = await contract.register(agentURI);
  const receipt = await tx.wait();

  let agentId: number | undefined;
  if (receipt?.logs) {
    for (const log of receipt.logs) {
      try {
        const iface = new ethers.Interface([
          'event Registered(uint256 indexed agentId, string agentURI, address indexed owner)',
        ]);
        const decoded = iface.parseLog(log);
        if (decoded && decoded.name === 'Registered') {
          agentId = Number(decoded.args.agentId);
          break;
        }
      } catch {
        // skip non-matching logs
      }
    }
  }

  return {
    txHash: receipt?.hash || tx.hash,
    agentId,
    agentURI,
  };
}

export async function fetchPublicConfig(): Promise<Record<string, unknown>> {
  const res = await fetch(`${FOUR_MEME_API}/public/config`);
  if (!res.ok) throw new Error(`Public config request failed: ${res.status}`);
  const data = await res.json();
  if (data.code !== '0' && data.code !== 0) {
    throw new Error(`Invalid public config: ${JSON.stringify(data)}`);
  }
  const symbols = data.data;
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new Error('No raisedToken in public config');
  }
  const published = symbols.filter((c: any) => c.status === 'PUBLISH');
  const list = published.length > 0 ? published : symbols;
  const config = list.find((c: any) => c.symbol === 'BNB') ?? list[0];
  return config as Record<string, unknown>;
}

export async function authenticateWithFourMeme(
  walletAddress: string,
  privateKey: string
): Promise<string> {
  const nonceRes = await fetch(`${FOUR_MEME_API}/private/user/nonce/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountAddress: walletAddress,
      verifyType: 'LOGIN',
      networkCode: 'BSC',
    }),
  });

  const nonceData = await nonceRes.json();
  if (nonceData.code !== '0' && nonceData.code !== 0) {
    throw new Error(`Failed to get nonce: ${nonceData.msg || JSON.stringify(nonceData)}`);
  }
  const nonce: string = nonceData.data;

  const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  const wallet = new ethers.Wallet(normalizedKey);
  const message = `You are sign in Meme ${nonce}`;
  const signature = await wallet.signMessage(message);

  const loginRes = await fetch(`${FOUR_MEME_API}/private/user/login/dex`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      region: 'WEB',
      langType: 'EN',
      loginIp: '',
      inviteCode: '',
      verifyInfo: {
        address: walletAddress,
        networkCode: 'BSC',
        signature,
        verifyType: 'LOGIN',
      },
      walletName: 'MetaMask',
    }),
  });

  const loginData = await loginRes.json();
  if (loginData.code !== '0' && loginData.code !== 0) {
    throw new Error(`Login failed: ${loginData.msg || JSON.stringify(loginData)}`);
  }

  return loginData.data as string;
}

export async function uploadNiyaImage(accessToken: string): Promise<string> {
  const imagePath = path.join(process.cwd(), 'public', 'images', 'niya-token.png');

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Niya image not found at ${imagePath}`);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const blob = new Blob([imageBuffer], { type: 'image/png' });

  const formData = new FormData();
  formData.append('file', blob, 'niya-token.png');

  const uploadRes = await fetch(`${FOUR_MEME_API}/private/token/upload`, {
    method: 'POST',
    headers: {
      'meme-web-access': accessToken,
    },
    body: formData,
  });

  const uploadData = await uploadRes.json();
  if (uploadData.code !== '0' && uploadData.code !== 0) {
    throw new Error(`Image upload failed: ${uploadData.msg || JSON.stringify(uploadData)}`);
  }

  return uploadData.data as string;
}

export interface CreateTokenResult {
  createArg: string;
  signature: string;
}

export async function createTaxToken(
  accessToken: string,
  imgUrl: string,
  recipientAddress: string,
  raisedToken: Record<string, unknown>,
  overrides?: Partial<LaunchConfig>
): Promise<CreateTokenResult> {
  const cfg = { ...LAUNCH_CONFIG, ...overrides };

  const totalSupply =
    typeof (raisedToken as any).totalAmount !== 'undefined'
      ? Number((raisedToken as any).totalAmount)
      : 1000000000;
  const raisedAmount =
    typeof (raisedToken as any).totalBAmount !== 'undefined'
      ? Number((raisedToken as any).totalBAmount)
      : 18;
  const saleRate =
    typeof (raisedToken as any).saleRate !== 'undefined'
      ? Number((raisedToken as any).saleRate)
      : 0.8;

  const body: Record<string, unknown> = {
    name: cfg.name,
    shortName: cfg.shortName,
    desc: cfg.desc,
    totalSupply,
    raisedAmount,
    saleRate,
    reserveRate: 0,
    imgUrl,
    raisedToken,
    launchTime: Date.now(),
    funGroup: false,
    label: cfg.label,
    lpTradingFee: 0.0025,
    webUrl: cfg.webUrl,
    twitterUrl: cfg.twitterUrl,
    telegramUrl: '',
    preSale: '0.7',
    clickFun: false,
    symbol: (raisedToken as any).symbol || 'BNB',
    dexType: 'PANCAKE_SWAP',
    rushMode: false,
    onlyMPC: false,
    feePlan: cfg.feePlan,
    tokenTaxInfo: {
      feeRate: cfg.taxConfig.feeRate,
      recipientAddress,
      recipientRate: cfg.taxConfig.recipientRate,
      burnRate: cfg.taxConfig.burnRate,
      divideRate: cfg.taxConfig.divideRate,
      liquidityRate: cfg.taxConfig.liquidityRate,
      minSharing: cfg.taxConfig.minSharing,
    },
  };

  const createRes = await fetch(`${FOUR_MEME_API}/private/token/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'meme-web-access': accessToken,
    },
    body: JSON.stringify(body),
  });

  const createData = await createRes.json();
  if (createData.code !== '0' && createData.code !== 0) {
    throw new Error(`Token creation failed: ${createData.msg || JSON.stringify(createData)}`);
  }

  return {
    createArg: toHex(createData.data.createArg),
    signature: toHex(createData.data.signature),
  };
}

export interface LaunchPreparation {
  isAgent: boolean;
  agentNftCount?: number;
  imgUrl: string;
  createArg: string;
  fourMemeSignature: string;
  txData: {
    to: string;
    data: string;
    value: string;
    description: string;
  };
  instructions: string[];
}

export async function runFullLaunchPreparation(
  walletAddress: string,
  privateKey: string
): Promise<LaunchPreparation> {
  const [agentCheck, raisedToken] = await Promise.all([
    verifyAgentWallet(walletAddress),
    fetchPublicConfig(),
  ]);

  const accessToken = await authenticateWithFourMeme(walletAddress, privateKey);
  const imgUrl = await uploadNiyaImage(accessToken);
  const { createArg, signature: fourMemeSignature } = await createTaxToken(
    accessToken,
    imgUrl,
    walletAddress,
    raisedToken
  );

  const iface = new ethers.Interface(TOKEN_MANAGER2_ABI);
  const DEV_BUY_BNB = '0.7';
  const devBuyWei = ethers.parseEther(DEV_BUY_BNB).toString();

  let txData = {
    to: TOKEN_MANAGER2_ADDRESS,
    data: '0x',
    value: devBuyWei,
    description: `Call TokenManager2.createToken(createArg, sign) on BSC Mainnet with ${DEV_BUY_BNB} BNB as dev buy value`,
  };

  try {
    const data = iface.encodeFunctionData('createToken', [
      ethers.getBytes(createArg as `0x${string}`),
      ethers.getBytes(fourMemeSignature as `0x${string}`),
    ]);
    txData = { ...txData, data };
  } catch {
    // keep raw hex values if encoding fails
  }

  const instructions = [
    '1. Token parameters prepared and signed by four.meme.',
    `2. Submit tx to TokenManager2: ${TOKEN_MANAGER2_ADDRESS}`,
    `3. Call createToken(bytes createArg, bytes sign) — IMPORTANT: send ${DEV_BUY_BNB} BNB as the transaction value (dev buy).`,
    '4. Use MetaMask on BSC Mainnet, Remix IDE, or a script with viem/ethers.',
    `5. In Remix/MetaMask: set Value to ${DEV_BUY_BNB} BNB before confirming.`,
    '6. After tx confirms, token appears on four.meme with 3% Tax (80% → wallet, 20% → liquidity). AntiSniper disabled.',
  ];

  return {
    isAgent: agentCheck.isAgent,
    agentNftCount: agentCheck.nftCount,
    imgUrl,
    createArg,
    fourMemeSignature,
    txData,
    instructions,
  };
}
