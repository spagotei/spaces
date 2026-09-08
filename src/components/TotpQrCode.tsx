import { useMemo } from 'react'
import { Icon } from './Icon'
import { encodeQrMatrix } from '../utils/qr-code'

export function TotpQrCode({ uri, accountLabel = 'Spaces' }: { uri: string; accountLabel?: string }) {
  const matrix = useMemo(() => {
    try {
      return encodeQrMatrix(uri)
    } catch {
      return null
    }
  }, [uri])

  const quiet = 4
  const size = matrix?.length ?? 53
  const path = useMemo(() => {
    if (!matrix) return ''
    let d = ''
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix.length; x++) {
        if (matrix[y][x]) d += `M${x + quiet} ${y + quiet}h1v1h-1z`
      }
    }
    return d
  }, [matrix])

  return <div className="totp-qr-card-v31">
    <div className="totp-qr-image-v31">
      {matrix ? (
        <svg
          viewBox={`0 0 ${size + quiet * 2} ${size + quiet * 2}`}
          role="img"
          aria-label={`QR code for ${accountLabel} two-factor authentication`}
          shapeRendering="crispEdges"
        >
          <rect width="100%" height="100%" fill="#f5f1f8" />
          <path d={path} fill="#17131d" />
        </svg>
      ) : (
        <span><Icon name="activity" size={18}/>Use the setup key below</span>
      )}
    </div>
    <div>
      <strong>Scan with Authy or another authenticator</strong>
      <span>The QR code is generated locally inside Spaces and contains the same TOTP setup key shown below.</span>
    </div>
  </div>
}
