export type LiveEventType =
  | 'gift'
  | 'comment'
  | 'fanSticker'
  | 'like'
  | 'follow'
  | 'share'
  | 'member'
  | 'subscribe';

export type RelayState = 'idle' | 'connecting' | 'rotating' | 'connected' | 'offline' | 'error';

export type LiveEvent = {
  id: string;
  type: LiveEventType;
  timestamp: number;
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
  comment?: string;
  giftName?: string;
  repeatCount?: number;
  diamonds?: number;
  count?: number;
  total?: number;
  memberCount?: number;
  fanStickerId?: string;
  fanStickerName?: string;
  fanStickerImageUrl?: string;
};

export type LiveStats = {
  viewers: number;
  likes: number;
  gifts: number;
  diamonds: number;
  followers: number;
  shares: number;
  comments: number;
  fanStickers: number;
};

export type LeaderboardEntry = {
  uniqueId: string;
  nickname: string;
  profilePictureUrl?: string;
  gifts: number;
  diamonds: number;
  likes: number;
  comments: number;
  fanStickers: number;
  shares: number;
  follows: number;
  members: number;
  subscribes: number;
  score: number;
  updatedAt: number;
};

export type GoalKind = 'likes' | 'diamonds' | 'gifts' | 'followers' | 'shares' | 'viewers';
export type Goal = { id: string; title: string; kind: GoalKind; target: number; startValue: number; enabled: boolean; completedAt?: number };
export type AppMode = 'streamer' | 'spectator';
export type AccentTheme = 'lulu' | 'violet' | 'rose' | 'cyan';

export type SoundSlot =
  | 'gift'
  | 'follow'
  | 'like'
  | 'share'
  | 'comment'
  | 'fanSticker'
  | 'member'
  | 'subscribe'
  | 'goal'
  | 'rank';

export type SoundSetting = {
  enabled: boolean;
  uri?: string;
  name?: string;
  presetId?: string;
  volume: number;
};
export type SoundSettings = Record<SoundSlot, SoundSetting>;

export type SoundMixProfile = 'soft' | 'balanced' | 'impact';
export type SoundMixSettings = {
  masterVolume: number;
  profile: SoundMixProfile;
  duckMusic: boolean;
  duckMusicVolume: number;
  allowOverlap: boolean;
};

export type InteractionTriggerType =
  | 'command'
  | 'fanSticker'
  | 'gift'
  | 'follow'
  | 'share'
  | 'subscribe'
  | 'member';

export type InteractionActionType = 'sound' | 'tts' | 'sound_tts';
export type MatchMode = 'exact' | 'contains';

export type InteractionRule = {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: InteractionTriggerType;
  triggerValue: string;
  matchMode: MatchMode;
  actionType: InteractionActionType;
  sound?: SoundSetting;
  ttsText?: string;
  cooldownSeconds: number;
  lastTriggeredAt?: number;
};
