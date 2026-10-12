import React from 'react';
import {
  Instagram,
  Facebook,
  Youtube,
  MessageCircle,
  Bookmark,
  Send,
  Linkedin,
  Video,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { SocialPlatformType } from '@/types/storefrontManagement';

interface SocialIconProps {
  platform: SocialPlatformType | string;
  className?: string;
}

export const SocialIcon: React.FC<SocialIconProps> = ({ platform, className = 'w-4 h-4' }) => {
  const p = (platform || '').toUpperCase();

  switch (p) {
    case 'INSTAGRAM':
      return <Instagram className={className} />;
    case 'FACEBOOK':
      return <Facebook className={className} />;
    case 'YOUTUBE':
      return <Youtube className={className} />;
    case 'WHATSAPP':
      return <MessageCircle className={className} />;
    case 'PINTEREST':
      return <Bookmark className={className} />;
    case 'TELEGRAM':
      return <Send className={className} />;
    case 'LINKEDIN':
      return <Linkedin className={className} />;
    case 'TIKTOK':
      return <Video className={className} />;
    case 'WEBSITE':
      return <Globe className={className} />;
    case 'CUSTOM':
    default:
      return <ExternalLink className={className} />;
  }
};
