interface Props {
  visible: boolean;
  partialText: string;
  onCancel: () => void;
}

export function ListeningOverlay({ visible, partialText, onCancel }: Props) {
  if (!visible) return null;
  return (
    <div className="listening-overlay" role="dialog" aria-live="polite">
      <div className="listening-wave" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="listening-title">듣고 있어요</div>
      <div className="listening-sub">
        {partialText ? `"${partialText}"` : '편하게 말씀해 주세요'}
      </div>
      <button className="listening-cancel" onClick={onCancel} type="button">
        취소
      </button>
    </div>
  );
}
