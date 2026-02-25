import { Banner } from "@geotab/zenith";

interface WarningBannerProps {
  message: string | null;
}

export default function WarningBanner({ message }: WarningBannerProps) {
  if (!message) return null;

  return (
    <Banner type="warning" icon>
      {message}
    </Banner>
  );
}
