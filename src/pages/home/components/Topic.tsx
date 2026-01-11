import { useChannelsDrawer } from '../../../providers/ChannelsDrawerContext';
import { Menu } from 'lucide-react';
import { useCurrentStore } from '../../../store/current';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Topic = () => {
  const topic: string = useCurrentStore((state) => state.topic);

  const { setChannelsDrawerStatus } = useChannelsDrawer();

  return (
    <div className="px-4 flex h-16">
      <Button variant="ghost" onClick={setChannelsDrawerStatus} className="h-12 md:hidden">
        <Menu className="h-4 w-4" />
      </Button>
      <Input value={topic} disabled className="mb-4 flex-1 min-h-12" />
    </div>
  );
};

export default Topic;
