import { Hash, Home, User, Wrench } from 'lucide-react';
import { ChannelCategory } from '@shared/types';

const ChannelIcon = ({ category }: { category: ChannelCategory | undefined }) => {
  switch (category) {
    case ChannelCategory.priv:
      return <User className="h-4 w-4" />;
    case ChannelCategory.status:
      return <Home className="h-4 w-4" />;
    case ChannelCategory.debug:
      return <Wrench className="h-4 w-4" />;
    default:
      return <Hash className="h-4 w-4" />;
  }
};

export default ChannelIcon;
