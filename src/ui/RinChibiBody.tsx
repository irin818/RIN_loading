import type { BodyState } from "../body";

type RinChibiBodyProps = {
  state?: BodyState;
  compact?: boolean;
};

export function RinChibiBody({ state, compact = false }: RinChibiBodyProps) {
  const expression = state?.expression ?? "neutral";
  const motion = state?.motion ?? "idle-breathing";

  return (
    <div
      className={`rin-chibi ${compact ? "rin-chibi-compact" : ""}`}
      data-expression={expression}
      data-motion={motion}
      aria-label="RIN chibi Live2D-compatible SVG body"
    >
      <svg viewBox="0 0 360 460" role="img" aria-labelledby="rin-chibi-title">
        <title id="rin-chibi-title">
          RIN Q版 SVG 可动身体 / RIN chibi SVG rig body
        </title>
        <defs>
          <linearGradient id="hairGradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#75d2c6" />
            <stop offset="48%" stopColor="#2b9f9a" />
            <stop offset="100%" stopColor="#1f5d6a" />
          </linearGradient>
          <linearGradient id="dressGradient" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#354b7d" />
            <stop offset="100%" stopColor="#18223f" />
          </linearGradient>
          <linearGradient id="skinGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffe8d6" />
            <stop offset="100%" stopColor="#f4c4ad" />
          </linearGradient>
        </defs>

        <g className="rig-shadow">
          <ellipse cx="180" cy="430" rx="86" ry="18" fill="#183326" opacity="0.14" />
        </g>

        <g className="rig-hair-back">
          <path
            d="M89 186 C54 232 58 316 100 365 C118 333 118 266 106 214 Z"
            fill="#1f5d6a"
          />
          <path
            d="M271 186 C306 232 302 316 260 365 C242 333 242 266 254 214 Z"
            fill="#1f5d6a"
          />
        </g>

        <g className="rig-body">
          <path
            d="M112 314 C124 274 236 274 248 314 L270 410 C229 439 131 439 90 410 Z"
            fill="url(#dressGradient)"
          />
          <path
            d="M132 303 C151 325 208 325 228 303 L224 350 C206 364 154 364 136 350 Z"
            fill="#fff4e6"
          />
          <path
            d="M151 320 L180 354 L209 320 L222 374 C198 389 162 389 138 374 Z"
            fill="#d84d63"
          />
          <path
            d="M124 324 C96 337 83 365 82 397 C102 395 117 380 128 360 Z"
            fill="#ffe2d1"
          />
          <path
            d="M236 324 C264 337 277 365 278 397 C258 395 243 380 232 360 Z"
            fill="#ffe2d1"
          />
        </g>

        <g className="rig-neck">
          <path d="M158 254 H202 V300 C190 311 170 311 158 300 Z" fill="url(#skinGradient)" />
        </g>

        <g className="rig-head">
          <path
            d="M81 156 C84 80 132 40 180 40 C228 40 276 80 279 156 C282 233 236 277 180 277 C124 277 78 233 81 156 Z"
            fill="url(#hairGradient)"
          />
          <path
            d="M101 160 C103 103 135 70 180 70 C225 70 257 103 259 160 C262 222 226 257 180 257 C134 257 98 222 101 160 Z"
            fill="url(#skinGradient)"
          />
          <path
            d="M94 142 C119 77 167 60 236 91 C222 123 174 139 126 127 C117 137 109 149 102 165 Z"
            fill="url(#hairGradient)"
          />
          <path
            d="M155 65 C163 111 139 142 102 158 C91 120 108 80 155 65 Z"
            fill="#64c7bf"
          />
          <path
            d="M202 65 C197 109 221 139 258 158 C269 120 250 79 202 65 Z"
            fill="#2c9c9a"
          />
        </g>

        <g className="rig-face">
          <g className="rig-eye rig-eye-left">
            <ellipse cx="147" cy="174" rx="18" ry="24" fill="#203049" />
            <ellipse cx="152" cy="166" rx="6" ry="8" fill="#ffffff" opacity="0.9" />
            <path className="rig-blink" d="M126 174 Q147 188 168 174" stroke="#203049" strokeWidth="5" fill="none" strokeLinecap="round" />
          </g>
          <g className="rig-eye rig-eye-right">
            <ellipse cx="213" cy="174" rx="18" ry="24" fill="#203049" />
            <ellipse cx="218" cy="166" rx="6" ry="8" fill="#ffffff" opacity="0.9" />
            <path className="rig-blink" d="M192 174 Q213 188 234 174" stroke="#203049" strokeWidth="5" fill="none" strokeLinecap="round" />
          </g>
          <ellipse cx="121" cy="207" rx="18" ry="9" fill="#f09ca0" opacity="0.5" />
          <ellipse cx="239" cy="207" rx="18" ry="9" fill="#f09ca0" opacity="0.5" />
          <path className="rig-mouth rig-mouth-smile" d="M164 217 Q180 232 196 217" stroke="#9c4a4e" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path className="rig-mouth rig-mouth-soft" d="M170 222 Q180 227 190 222" stroke="#9c4a4e" strokeWidth="5" fill="none" strokeLinecap="round" />
        </g>

        <g className="rig-accessories">
          <path
            d="M137 287 C154 271 170 271 180 288 C190 271 206 271 223 287 C210 305 194 306 180 294 C166 306 150 305 137 287 Z"
            fill="#d84d63"
          />
          <circle cx="180" cy="291" r="9" fill="#ffd36b" />
          <path
            d="M132 48 C151 17 205 17 228 49 C202 39 161 39 132 48 Z"
            fill="#d84d63"
          />
          <path d="M154 42 C163 29 196 29 206 42" stroke="#ffd36b" strokeWidth="7" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
