export interface SendShoppingListResponse {
  status: string;
  messageId?: number | null;
  targetId?: string;
  targetName?: string;
  error?: string;
}

export interface TelegramTarget {
  id: string;
  name: string;
}

export interface AddTelegramTargetResponse {
  status: string;
  created?: boolean;
  target?: {
    id: string;
    name: string;
    chatId?: string;
  };
  error?: string;
}

export interface TelegramTargetsResponse {
  status: string;
  targets?: TelegramTarget[];
  error?: string;
}

export interface LastShoppingListResponse {
  status: string;
  items?: string[];
  sentAt?: string | null;
  messageId?: number | null;
  targetId?: string;
  targetName?: string;
  error?: string;
}
