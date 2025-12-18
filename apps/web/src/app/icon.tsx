import { ImageResponse } from 'next/og';

// Icon for the app - theatre masks emoji
export const runtime = 'edge';
export const size = { width: 200, height: 200 };
export const contentType = 'image/png';

export default async function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
          fontSize: 120,
        }}
      >
        🎭
      </div>
    ),
    {
      ...size,
    }
  );
}
