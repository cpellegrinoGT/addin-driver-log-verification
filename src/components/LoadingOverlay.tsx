import { ProgressBar } from "@geotab/zenith";

interface LoadingOverlayProps {
  visible: boolean;
  text: string;
  progress: number;
}

export default function LoadingOverlay({ visible, text, progress }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div className="dlv-loading-overlay">
      <div className="dlv-loading-content">
        <span className="dlv-loading-text">{text}</span>
        <div className="dlv-progress-wrap">
          <ProgressBar now={progress} min={0} max={100} size="medium" />
        </div>
      </div>
    </div>
  );
}
