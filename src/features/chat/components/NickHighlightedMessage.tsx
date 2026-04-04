import MessageText from './MessageText';

interface NickHighlightedMessageProps {
  text: string;
  displayNick: string;
  color?: string;
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
}

const NickHighlightedMessage = ({ text, displayNick, color, onContextMenu }: NickHighlightedMessageProps) => {
  const nickIndex = text.indexOf(displayNick);
  if (nickIndex === -1) {
    return <MessageText text={text} color={color} />;
  }
  const before = text.slice(0, nickIndex);
  const after = text.slice(nickIndex + displayNick.length);
  return (
    <span style={{ color }}>
      {before}
      <span className="cursor-pointer hover:underline" onContextMenu={onContextMenu}>{displayNick}</span>
      {after}
    </span>
  );
};

export default NickHighlightedMessage;
