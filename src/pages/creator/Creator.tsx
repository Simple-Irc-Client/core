import { useSettingsStore } from '../../store/settings';
import CreatorChannelList from './CreatorChannelList';
import CreatorNick from './CreatorNick';
import CreatorPassword from './CreatorPassword';
import CreatorServer from './CreatorServer';
import CreatorLoading from './CreatorLoading';

const Creator = () => {
  const creatorStep = useSettingsStore((state) => state.creatorStep);

  return (
    <div className={`mx-auto ${creatorStep === 'channels' ? 'max-w-screen-md' : 'max-w-screen-sm'}`}>
      <div className="h-screen flex flex-col items-center">
        {creatorStep === 'nick' && (
          <div className="mt-auto md:mt-[40%] mb-auto">
            <CreatorNick />
          </div>
        )}
        {creatorStep === 'server' && (
          <div className="mt-auto md:mt-[40%] mb-auto">
            <CreatorServer />
          </div>
        )}
        {creatorStep === 'password' && (
          <div className="mt-auto md:mt-[40%] mb-auto">
            <CreatorPassword />
          </div>
        )}
        {creatorStep === 'loading' && (
          <div className="mt-auto md:mt-[40%] mb-auto w-full">
            <CreatorLoading />
          </div>
        )}
        {creatorStep === 'channels' && (
          <div className="mt-auto md:mt-[25%] mb-auto w-full">
            <CreatorChannelList />
          </div>
        )}
      </div>
    </div>
  );
};

export default Creator;
