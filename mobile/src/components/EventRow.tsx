import { Image, Text, View } from 'react-native';
import { Gift, Heart, MessageCircle, Share2, Smile, Star, UserPlus, Users } from 'lucide-react-native';
import type { LiveEvent } from '@/types/live';
import { eventText, relativeTime } from '@/utils/format';

function EventIcon({ event }: { event: LiveEvent }) {
  const props = { size: 16, color: '#FF9DDA', strokeWidth: 2.5 };
  if (event.type === 'gift') return <Gift {...props} />;
  if (event.type === 'comment') return <MessageCircle {...props} />;
  if (event.type === 'sticker') return <Smile {...props} />;
  if (event.type === 'like') return <Heart {...props} />;
  if (event.type === 'share') return <Share2 {...props} />;
  if (event.type === 'follow') return <UserPlus {...props} />;
  if (event.type === 'subscribe') return <Star {...props} />;
  return <Users {...props} />;
}

export function EventRow({ event }: { event: LiveEvent }) {
  const initial = (event.nickname || event.uniqueId || '?').slice(0, 1).toUpperCase();
  return (
    <View className="flex-row items-center gap-3 border-b border-white/[0.055] py-3.5">
      {event.type === 'sticker' && event.stickerImageUrl ? (
        <Image source={{ uri: event.stickerImageUrl }} className="h-11 w-11 rounded-2xl bg-white/10" />
      ) : event.profilePictureUrl ? (
        <Image source={{ uri: event.profilePictureUrl }} className="h-11 w-11 rounded-full bg-white/10" />
      ) : (
        <View className="h-11 w-11 items-center justify-center rounded-full bg-lulu-500/20">
          <Text className="font-black text-lulu-200">{initial}</Text>
        </View>
      )}
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <EventIcon event={event} />
          <Text className="flex-1 text-sm font-extrabold text-white" numberOfLines={1}>
            {event.nickname || `@${event.uniqueId}`}
          </Text>
          <Text className="text-[10px] font-semibold text-white/30">{relativeTime(event.timestamp)}</Text>
        </View>
        <Text
          selectable={event.type === 'sticker'}
          className={`mt-1 text-xs leading-5 ${
            event.type === 'comment' || event.type === 'sticker' ? 'text-white/75' : 'text-white/50'
          }`}
          numberOfLines={event.type === 'comment' ? 2 : event.type === 'sticker' ? 2 : 1}
        >
          {eventText(event)}
        </Text>
      </View>
    </View>
  );
}
