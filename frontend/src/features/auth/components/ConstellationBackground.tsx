export function ConstellationBackground() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <style>{`
        @keyframes sb1 { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
        @keyframes sb2 { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes sb3 { 0%, 100% { opacity: 0.75; } 50% { opacity: 1; } }
        @keyframes sb4 { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.95; } }
        @keyframes gp1 { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.2); } }
        @keyframes gp2 { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.85; transform: scale(1.25); } }
        @keyframes gp3 { 0%, 100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 0.75; transform: scale(1.15); } }
        @keyframes sky-drift {
          0%   { transform: translate(-50%, -50%) rotate(-3deg); }
          50%  { transform: translate(-50%, -50%) rotate(3deg); }
          100% { transform: translate(-50%, -50%) rotate(-3deg); }
        }
        @keyframes nebula-breathe { 0%, 100% { opacity: 0.18; } 50% { opacity: 0.4; } }
        @keyframes meteor-streak {
          0%   { transform: translate(0, 0); opacity: 0; }
          5%   { opacity: 0.85; }
          15%  { opacity: 0.85; }
          25%  { transform: translate(200px, 200px); opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes meteor-streak-2 {
          0%   { transform: translate(0, 0); opacity: 0; }
          5%   { opacity: 0.6; }
          18%  { opacity: 0.6; }
          30%  { transform: translate(160px, 120px); opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes lf { 0%, 100% { opacity: 0.22; } 50% { opacity: 0.42; } }
      `}</style>

      {/* Slowly drifting sky — slight oversize to cover rotation edges */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "115%",
          height: "115%",
          animation: "sky-drift 120s ease-in-out infinite",
          transformOrigin: "center center",
        }}
      >
        <svg
          viewBox="0 0 560 900"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="gw">
              <stop offset="0%" stopColor="var(--text-primary)" stopOpacity="0.9" />
              <stop offset="35%" stopColor="var(--text-primary)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--text-primary)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="gb">
              <stop offset="0%" stopColor="#FF6B4A" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#E8523A" stopOpacity="0.45" />
              <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="gr">
              <stop offset="0%" stopColor="#A8D4FF" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#7BB8F0" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#4A90D0" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#4A90D0" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ga">
              <stop offset="0%" stopColor="#FF5533" stopOpacity="0.9" />
              <stop offset="25%" stopColor="#CC3322" stopOpacity="0.4" />
              <stop offset="60%" stopColor="var(--primary)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="gg">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
              <stop offset="30%" stopColor="var(--accent)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="gs">
              <stop offset="0%" stopColor="#CCE0FF" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#99C0FF" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#6699DD" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#6699DD" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="gald">
              <stop offset="0%" stopColor="#FF8844" stopOpacity="0.9" />
              <stop offset="25%" stopColor="#E06630" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#BB4420" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#BB4420" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="nebula-orion" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#C82848" stopOpacity="0.30" />
              <stop offset="25%" stopColor="var(--primary)" stopOpacity="0.18" />
              <stop offset="50%" stopColor="#7A2845" stopOpacity="0.10" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            <linearGradient id="mw" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="15%" stopColor="var(--text-primary)" stopOpacity="0.03" />
              <stop offset="30%" stopColor="var(--text-primary)" stopOpacity="0.07" />
              <stop offset="50%" stopColor="var(--text-primary)" stopOpacity="0.08" />
              <stop offset="70%" stopColor="var(--text-primary)" stopOpacity="0.07" />
              <stop offset="85%" stopColor="var(--text-primary)" stopOpacity="0.03" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>

          {/* ══════ MILKY WAY BAND ══════ */}
          <rect x="-200" y="-50" width="960" height="280" fill="url(#mw)" transform="rotate(30 280 450)" opacity="0.8" />
          <g opacity="0.5">
            {[
              [85,180],[120,210],[155,195],[190,230],[210,215],[245,250],[270,240],[300,270],
              [325,260],[350,290],[375,280],[400,310],[420,300],[445,330],[465,315],[490,345],
              [130,225],[175,215],[215,245],[260,260],[305,285],[345,275],[390,305],[435,320],
            ].map(([cx, cy], i) => (
              <circle key={`mw-${i}`} cx={cx} cy={cy} r={i % 4 === 0 ? 0.7 : 0.4} fill="var(--text-primary)" opacity={0.2 + (i % 5) * 0.06} />
            ))}
          </g>

          {/* ══════ 1. ORION — center ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.30)" strokeWidth="0.9">
              <line x1="230" y1="380" x2="255" y2="430" />
              <line x1="340" y1="385" x2="315" y2="430" />
              <line x1="255" y1="430" x2="285" y2="435" />
              <line x1="285" y1="435" x2="315" y2="430" />
              <line x1="255" y1="430" x2="240" y2="500" />
              <line x1="315" y1="430" x2="335" y2="495" />
              <line x1="230" y1="380" x2="340" y2="385" />
              <line x1="285" y1="355" x2="285" y2="380" />
              <line x1="285" y1="380" x2="230" y2="380" />
              <line x1="285" y1="380" x2="340" y2="385" />
              <line x1="340" y1="385" x2="365" y2="365" />
              <line x1="365" y1="365" x2="375" y2="340" />
              <line x1="230" y1="380" x2="205" y2="360" />
              <line x1="205" y1="360" x2="195" y2="400" />
            </g>
            <ellipse cx="285" cy="455" rx="30" ry="18" fill="url(#nebula-orion)" style={{ animation: "nebula-breathe 12s ease-in-out infinite" }} />
            <circle cx="230" cy="380" r="14" fill="url(#gb)" style={{ animation: "gp1 7s ease-in-out infinite" }} />
            <circle cx="230" cy="380" r="3" fill="#FF6B4A" opacity="0.95" style={{ animation: "sb1 7s ease-in-out infinite" }} />
            <circle cx="335" cy="495" r="12" fill="url(#gr)" style={{ animation: "gp2 6s ease-in-out infinite" }} />
            <circle cx="335" cy="495" r="2.8" fill="#A8D4FF" opacity="0.95" style={{ animation: "sb2 6s ease-in-out infinite" }} />
            <circle cx="340" cy="385" r="7" fill="url(#gw)" style={{ animation: "gp3 8s ease-in-out infinite" }} />
            <circle cx="340" cy="385" r="2.2" fill="var(--text-primary)" opacity="0.9" style={{ animation: "sb3 8s ease-in-out infinite" }} />
            <circle cx="255" cy="430" r="5" fill="url(#gw)" style={{ animation: "gp3 5s ease-in-out infinite" }} />
            <circle cx="255" cy="430" r="2" fill="var(--text-primary)" opacity="0.85" />
            <circle cx="285" cy="435" r="5" fill="url(#gw)" style={{ animation: "gp2 4.5s ease-in-out infinite" }} />
            <circle cx="285" cy="435" r="2.2" fill="var(--text-primary)" opacity="0.9" style={{ animation: "sb1 4.5s ease-in-out infinite" }} />
            <circle cx="315" cy="430" r="5" fill="url(#gw)" style={{ animation: "gp3 5.5s ease-in-out infinite" }} />
            <circle cx="315" cy="430" r="2" fill="var(--text-primary)" opacity="0.85" />
            <circle cx="240" cy="500" r="6" fill="url(#gw)" style={{ animation: "gp3 6.5s ease-in-out infinite" }} />
            <circle cx="240" cy="500" r="1.8" fill="var(--text-primary)" opacity="0.75" />
            <circle cx="285" cy="355" r="1.5" fill="var(--text-primary)" opacity="0.7" />
            <circle cx="365" cy="365" r="1.3" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="375" cy="340" r="1.2" fill="var(--text-primary)" opacity="0.55" />
            <circle cx="205" cy="360" r="1.3" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="195" cy="400" r="1.2" fill="var(--text-primary)" opacity="0.55" />
            <text x="265" y="525" fontFamily="var(--font-mono)" fontSize="8" fill="var(--text-primary)" letterSpacing="3" style={{ animation: "lf 10s ease-in-out infinite" }}>ORION</text>
          </g>

          {/* ══════ 2. URSA MAJOR — upper left ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.28)" strokeWidth="0.9">
              <line x1="55" y1="100" x2="95" y2="90" />
              <line x1="95" y1="90" x2="105" y2="118" />
              <line x1="105" y1="118" x2="65" y2="128" />
              <line x1="65" y1="128" x2="55" y2="100" />
              <line x1="95" y1="90" x2="135" y2="78" />
              <line x1="135" y1="78" x2="168" y2="82" />
              <line x1="168" y1="82" x2="192" y2="95" />
            </g>
            <circle cx="55" cy="100" r="6" fill="url(#gw)" style={{ animation: "gp2 7s ease-in-out infinite 1s" }} />
            <circle cx="55" cy="100" r="2" fill="var(--text-primary)" opacity="0.85" style={{ animation: "sb1 7s ease-in-out infinite 1s" }} />
            <circle cx="95" cy="90" r="1.8" fill="var(--text-primary)" opacity="0.8" style={{ animation: "sb2 6s ease-in-out infinite" }} />
            <circle cx="105" cy="118" r="1.7" fill="var(--text-primary)" opacity="0.8" style={{ animation: "sb3 5s ease-in-out infinite" }} />
            <circle cx="65" cy="128" r="1.7" fill="var(--text-primary)" opacity="0.8" />
            <circle cx="135" cy="78" r="1.8" fill="var(--text-primary)" opacity="0.8" />
            <circle cx="168" cy="82" r="7" fill="url(#gw)" style={{ animation: "gp3 6s ease-in-out infinite" }} />
            <circle cx="168" cy="82" r="2" fill="var(--text-primary)" opacity="0.85" style={{ animation: "sb1 6s ease-in-out infinite" }} />
            <circle cx="192" cy="95" r="1.7" fill="var(--text-primary)" opacity="0.8" />
            <text x="70" y="148" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--text-primary)" letterSpacing="2" style={{ animation: "lf 11s ease-in-out infinite 3s" }}>URSA MAJOR</text>
          </g>

          {/* ══════ 3. CASSIOPEIA — upper right ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.28)" strokeWidth="0.9">
              <line x1="380" y1="95" x2="410" y2="68" />
              <line x1="410" y1="68" x2="440" y2="100" />
              <line x1="440" y1="100" x2="470" y2="70" />
              <line x1="470" y1="70" x2="500" y2="98" />
            </g>
            <circle cx="380" cy="95" r="9" fill="url(#gg)" style={{ animation: "gp1 9s ease-in-out infinite" }} />
            <circle cx="380" cy="95" r="2.3" fill="#E8C84A" opacity="0.9" style={{ animation: "sb1 9s ease-in-out infinite" }} />
            <circle cx="410" cy="68" r="1.8" fill="var(--text-primary)" opacity="0.8" style={{ animation: "sb2 5s ease-in-out infinite" }} />
            <circle cx="440" cy="100" r="2" fill="var(--text-primary)" opacity="0.8" style={{ animation: "sb4 7s ease-in-out infinite" }} />
            <circle cx="470" cy="70" r="1.7" fill="var(--text-primary)" opacity="0.75" style={{ animation: "sb3 6s ease-in-out infinite" }} />
            <circle cx="500" cy="98" r="1.5" fill="var(--text-primary)" opacity="0.7" />
            <text x="400" y="120" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--text-primary)" letterSpacing="2" style={{ animation: "lf 12s ease-in-out infinite 2s" }}>CASSIOPEIA</text>
          </g>

          {/* ══════ 4. GEMINI — upper center ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.25)" strokeWidth="0.8">
              <line x1="230" y1="120" x2="242" y2="152" />
              <line x1="242" y1="152" x2="238" y2="182" />
              <line x1="258" y1="118" x2="270" y2="148" />
              <line x1="270" y1="148" x2="275" y2="178" />
              <line x1="242" y1="152" x2="270" y2="148" />
              <line x1="238" y1="182" x2="228" y2="205" />
              <line x1="275" y1="178" x2="290" y2="200" />
            </g>
            <circle cx="230" cy="120" r="8" fill="url(#gg)" style={{ animation: "gp1 8s ease-in-out infinite 2s" }} />
            <circle cx="230" cy="120" r="2.2" fill="#E8C84A" opacity="0.9" style={{ animation: "sb1 8s ease-in-out infinite 2s" }} />
            <circle cx="258" cy="118" r="8" fill="url(#gw)" style={{ animation: "gp2 7s ease-in-out infinite 1s" }} />
            <circle cx="258" cy="118" r="2.2" fill="var(--text-primary)" opacity="0.9" style={{ animation: "sb2 7s ease-in-out infinite 1s" }} />
            <circle cx="242" cy="152" r="1.4" fill="var(--text-primary)" opacity="0.65" />
            <circle cx="270" cy="148" r="1.4" fill="var(--text-primary)" opacity="0.65" style={{ animation: "sb3 6s ease-in-out infinite" }} />
            <circle cx="238" cy="182" r="1.3" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="275" cy="178" r="1.3" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="228" cy="205" r="1.2" fill="var(--text-primary)" opacity="0.55" />
            <circle cx="290" cy="200" r="1.2" fill="var(--text-primary)" opacity="0.55" />
            <text x="235" y="222" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--text-primary)" letterSpacing="2" style={{ animation: "lf 11s ease-in-out infinite 3s" }}>GEMINI</text>
          </g>

          {/* ══════ 5. TAURUS — left of Orion ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.25)" strokeWidth="0.8">
              <line x1="130" y1="310" x2="155" y2="325" />
              <line x1="155" y1="325" x2="145" y2="350" />
              <line x1="155" y1="325" x2="180" y2="340" />
              <line x1="130" y1="310" x2="105" y2="290" />
              <line x1="130" y1="310" x2="115" y2="330" />
              <line x1="115" y1="330" x2="90" y2="322" />
            </g>
            <circle cx="155" cy="325" r="10" fill="url(#gald)" style={{ animation: "gp1 7s ease-in-out infinite 4s" }} />
            <circle cx="155" cy="325" r="2.5" fill="#FF8844" opacity="0.9" style={{ animation: "sb1 7s ease-in-out infinite 4s" }} />
            <circle cx="130" cy="310" r="1.5" fill="var(--text-primary)" opacity="0.7" style={{ animation: "sb2 6s ease-in-out infinite" }} />
            <circle cx="145" cy="350" r="1.3" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="180" cy="340" r="1.4" fill="var(--text-primary)" opacity="0.65" style={{ animation: "sb4 5s ease-in-out infinite" }} />
            <circle cx="105" cy="290" r="1.4" fill="var(--text-primary)" opacity="0.65" />
            <circle cx="115" cy="330" r="1.3" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="90" cy="322" r="1.3" fill="var(--text-primary)" opacity="0.6" />
            <text x="110" y="370" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--text-primary)" letterSpacing="2" style={{ animation: "lf 10s ease-in-out infinite 5s" }}>TAURUS</text>
          </g>

          {/* ══════ 6. CANIS MAJOR — below Orion ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.25)" strokeWidth="0.8">
              <line x1="220" y1="570" x2="240" y2="598" />
              <line x1="240" y1="598" x2="225" y2="630" />
              <line x1="240" y1="598" x2="270" y2="608" />
              <line x1="270" y1="608" x2="285" y2="640" />
              <line x1="270" y1="608" x2="295" y2="595" />
              <line x1="225" y1="630" x2="212" y2="658" />
            </g>
            <circle cx="220" cy="570" r="15" fill="url(#gs)" style={{ animation: "gp1 5s ease-in-out infinite" }} />
            <circle cx="220" cy="570" r="3.2" fill="#CCE0FF" opacity="1" style={{ animation: "sb1 5s ease-in-out infinite" }} />
            <circle cx="240" cy="598" r="1.5" fill="var(--text-primary)" opacity="0.65" style={{ animation: "sb3 6s ease-in-out infinite" }} />
            <circle cx="225" cy="630" r="1.4" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="270" cy="608" r="1.5" fill="var(--text-primary)" opacity="0.65" style={{ animation: "sb4 7s ease-in-out infinite" }} />
            <circle cx="285" cy="640" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <circle cx="295" cy="595" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <circle cx="212" cy="658" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <text x="198" y="678" fontFamily="var(--font-mono)" fontSize="6" fill="var(--text-primary)" letterSpacing="1.5" style={{ animation: "lf 9s ease-in-out infinite 2s" }}>CANIS MAJOR</text>
          </g>

          {/* ══════ 7. LEO — left center ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.25)" strokeWidth="0.8">
              <line x1="45" y1="450" x2="58" y2="430" />
              <line x1="58" y1="430" x2="78" y2="418" />
              <line x1="78" y1="418" x2="95" y2="428" />
              <line x1="95" y1="428" x2="90" y2="448" />
              <line x1="90" y1="448" x2="70" y2="458" />
              <line x1="70" y1="458" x2="45" y2="450" />
              <line x1="90" y1="448" x2="130" y2="455" />
              <line x1="130" y1="455" x2="155" y2="442" />
            </g>
            <circle cx="45" cy="450" r="10" fill="url(#gw)" style={{ animation: "gp1 7.5s ease-in-out infinite" }} />
            <circle cx="45" cy="450" r="2.5" fill="var(--text-primary)" opacity="0.9" style={{ animation: "sb1 7.5s ease-in-out infinite" }} />
            <circle cx="58" cy="430" r="1.5" fill="var(--text-primary)" opacity="0.7" style={{ animation: "sb3 5s ease-in-out infinite" }} />
            <circle cx="78" cy="418" r="1.4" fill="var(--text-primary)" opacity="0.65" />
            <circle cx="95" cy="428" r="1.5" fill="var(--text-primary)" opacity="0.7" style={{ animation: "sb4 6s ease-in-out infinite" }} />
            <circle cx="90" cy="448" r="1.4" fill="var(--text-primary)" opacity="0.65" />
            <circle cx="70" cy="458" r="1.3" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="130" cy="455" r="1.4" fill="var(--text-primary)" opacity="0.65" style={{ animation: "sb2 7s ease-in-out infinite" }} />
            <circle cx="155" cy="442" r="6" fill="url(#gs)" style={{ animation: "gp3 8s ease-in-out infinite 2s" }} />
            <circle cx="155" cy="442" r="1.8" fill="#CCE0FF" opacity="0.8" style={{ animation: "sb2 8s ease-in-out infinite 2s" }} />
            <text x="70" y="478" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--text-primary)" letterSpacing="2" style={{ animation: "lf 10s ease-in-out infinite 6s" }}>LEO</text>
          </g>

          {/* ══════ 8. SCORPIUS — lower left ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.25)" strokeWidth="0.8">
              <line x1="55" y1="640" x2="72" y2="658" />
              <line x1="85" y1="635" x2="72" y2="658" />
              <line x1="72" y1="658" x2="88" y2="692" />
              <line x1="88" y1="692" x2="75" y2="725" />
              <line x1="75" y1="725" x2="85" y2="755" />
              <line x1="85" y1="755" x2="110" y2="775" />
              <line x1="110" y1="775" x2="140" y2="778" />
              <line x1="140" y1="778" x2="155" y2="760" />
            </g>
            <circle cx="88" cy="692" r="12" fill="url(#ga)" style={{ animation: "gp1 8s ease-in-out infinite 1s" }} />
            <circle cx="88" cy="692" r="2.8" fill="#FF5533" opacity="0.95" style={{ animation: "sb1 8s ease-in-out infinite 1s" }} />
            <circle cx="55" cy="640" r="1.4" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="85" cy="635" r="1.5" fill="var(--text-primary)" opacity="0.65" style={{ animation: "sb4 6s ease-in-out infinite" }} />
            <circle cx="72" cy="658" r="1.6" fill="var(--text-primary)" opacity="0.65" />
            <circle cx="75" cy="725" r="1.5" fill="var(--text-primary)" opacity="0.6" style={{ animation: "sb2 7s ease-in-out infinite" }} />
            <circle cx="85" cy="755" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <circle cx="110" cy="775" r="1.4" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="140" cy="778" r="1.3" fill="var(--text-primary)" opacity="0.55" style={{ animation: "sb3 5.5s ease-in-out infinite" }} />
            <circle cx="155" cy="760" r="1.4" fill="var(--text-primary)" opacity="0.6" />
            <text x="35" y="715" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--text-primary)" letterSpacing="2" style={{ animation: "lf 11s ease-in-out infinite 4s" }}>SCORPIUS</text>
          </g>

          {/* ══════ 9. LYRA — right center ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.25)" strokeWidth="0.8">
              <line x1="470" y1="420" x2="455" y2="450" />
              <line x1="470" y1="420" x2="488" y2="450" />
              <line x1="455" y1="450" x2="452" y2="478" />
              <line x1="488" y1="450" x2="492" y2="478" />
              <line x1="452" y1="478" x2="492" y2="478" />
            </g>
            <circle cx="470" cy="420" r="12" fill="url(#gs)" style={{ animation: "gp1 6s ease-in-out infinite 2s" }} />
            <circle cx="470" cy="420" r="2.6" fill="#CCE0FF" opacity="0.95" style={{ animation: "sb1 6s ease-in-out infinite 2s" }} />
            <circle cx="455" cy="450" r="1.4" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="488" cy="450" r="1.3" fill="var(--text-primary)" opacity="0.55" style={{ animation: "sb3 5s ease-in-out infinite" }} />
            <circle cx="452" cy="478" r="1.2" fill="var(--text-primary)" opacity="0.5" />
            <circle cx="492" cy="478" r="1.2" fill="var(--text-primary)" opacity="0.5" />
            <text x="455" y="498" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--text-primary)" letterSpacing="2" style={{ animation: "lf 9s ease-in-out infinite 5s" }}>LYRA</text>
          </g>

          {/* ══════ 10. CORONA BOREALIS — left of center ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.25)" strokeWidth="0.8">
              <line x1="120" y1="240" x2="148" y2="222" />
              <line x1="148" y1="222" x2="180" y2="215" />
              <line x1="180" y1="215" x2="210" y2="220" />
              <line x1="210" y1="220" x2="230" y2="238" />
            </g>
            <circle cx="180" cy="215" r="9" fill="url(#gw)" style={{ animation: "gp2 7s ease-in-out infinite 3s" }} />
            <circle cx="180" cy="215" r="2.3" fill="var(--text-primary)" opacity="0.95" style={{ animation: "sb1 7s ease-in-out infinite 3s" }} />
            <circle cx="120" cy="240" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <circle cx="148" cy="222" r="1.5" fill="var(--text-primary)" opacity="0.65" style={{ animation: "sb4 6s ease-in-out infinite" }} />
            <circle cx="210" cy="220" r="1.4" fill="var(--text-primary)" opacity="0.6" style={{ animation: "sb2 8s ease-in-out infinite" }} />
            <circle cx="230" cy="238" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <text x="132" y="258" fontFamily="var(--font-mono)" fontSize="5.5" fill="var(--text-primary)" letterSpacing="1.5" style={{ animation: "lf 13s ease-in-out infinite 1s" }}>CORONA BOREALIS</text>
          </g>

          {/* ══════ 11. CYGNUS — right ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.25)" strokeWidth="0.8">
              <line x1="490" y1="270" x2="490" y2="340" />
              <line x1="462" y1="300" x2="518" y2="308" />
              <line x1="490" y1="340" x2="490" y2="365" />
            </g>
            <circle cx="490" cy="270" r="9" fill="url(#gw)" style={{ animation: "gp1 6.5s ease-in-out infinite 1s" }} />
            <circle cx="490" cy="270" r="2.3" fill="var(--text-primary)" opacity="0.9" style={{ animation: "sb1 6.5s ease-in-out infinite 1s" }} />
            <circle cx="462" cy="300" r="1.5" fill="var(--text-primary)" opacity="0.65" style={{ animation: "sb3 7s ease-in-out infinite" }} />
            <circle cx="518" cy="308" r="1.5" fill="var(--text-primary)" opacity="0.65" style={{ animation: "sb4 5.5s ease-in-out infinite" }} />
            <circle cx="490" cy="340" r="1.4" fill="var(--text-primary)" opacity="0.6" style={{ animation: "sb2 8s ease-in-out infinite" }} />
            <circle cx="490" cy="365" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <text x="472" y="385" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--text-primary)" letterSpacing="2" style={{ animation: "lf 10s ease-in-out infinite 7s" }}>CYGNUS</text>
          </g>

          {/* ══════ 12. PERSEUS — upper right ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.22)" strokeWidth="0.8">
              <line x1="430" y1="160" x2="445" y2="190" />
              <line x1="445" y1="190" x2="438" y2="218" />
              <line x1="438" y1="218" x2="455" y2="242" />
              <line x1="445" y1="190" x2="468" y2="198" />
              <line x1="445" y1="190" x2="422" y2="205" />
            </g>
            <circle cx="430" cy="160" r="7" fill="url(#gw)" style={{ animation: "gp2 7s ease-in-out infinite 3s" }} />
            <circle cx="430" cy="160" r="2" fill="var(--text-primary)" opacity="0.85" style={{ animation: "sb1 7s ease-in-out infinite 3s" }} />
            <circle cx="445" cy="190" r="1.6" fill="var(--text-primary)" opacity="0.7" style={{ animation: "sb2 6s ease-in-out infinite" }} />
            <circle cx="438" cy="218" r="1.4" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="455" cy="242" r="7" fill="url(#gr)" style={{ animation: "gp1 2.87s ease-in-out infinite" }} />
            <circle cx="455" cy="242" r="2" fill="#A8D4FF" opacity="0.85" style={{ animation: "sb3 2.87s ease-in-out infinite" }} />
            <circle cx="468" cy="198" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <circle cx="422" cy="205" r="1.3" fill="var(--text-primary)" opacity="0.55" style={{ animation: "sb4 5s ease-in-out infinite" }} />
            <text x="418" y="262" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--text-primary)" letterSpacing="2" style={{ animation: "lf 12s ease-in-out infinite 4s" }}>PERSEUS</text>
          </g>

          {/* ══════ 13. AQUILA — right of center ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.22)" strokeWidth="0.8">
              <line x1="420" y1="550" x2="438" y2="525" />
              <line x1="438" y1="525" x2="456" y2="550" />
              <line x1="438" y1="525" x2="438" y2="500" />
              <line x1="438" y1="525" x2="438" y2="568" />
            </g>
            <circle cx="438" cy="525" r="10" fill="url(#gw)" style={{ animation: "gp1 6s ease-in-out infinite 3s" }} />
            <circle cx="438" cy="525" r="2.5" fill="var(--text-primary)" opacity="0.95" style={{ animation: "sb1 6s ease-in-out infinite 3s" }} />
            <circle cx="420" cy="550" r="1.5" fill="var(--text-primary)" opacity="0.6" style={{ animation: "sb2 7s ease-in-out infinite" }} />
            <circle cx="456" cy="550" r="1.5" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="438" cy="500" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <circle cx="438" cy="568" r="1.2" fill="var(--text-primary)" opacity="0.5" />
            <text x="420" y="588" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--text-primary)" letterSpacing="2" style={{ animation: "lf 10s ease-in-out infinite 6s" }}>AQUILA</text>
          </g>

          {/* ══════ 14. VIRGO — lower center ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.22)" strokeWidth="0.8">
              <line x1="310" y1="615" x2="332" y2="600" />
              <line x1="332" y1="600" x2="318" y2="575" />
              <line x1="332" y1="600" x2="355" y2="588" />
              <line x1="332" y1="600" x2="345" y2="628" />
              <line x1="345" y1="628" x2="328" y2="658" />
              <line x1="345" y1="628" x2="372" y2="640" />
            </g>
            <circle cx="328" cy="658" r="10" fill="url(#gs)" style={{ animation: "gp2 6.5s ease-in-out infinite 1s" }} />
            <circle cx="328" cy="658" r="2.5" fill="#CCE0FF" opacity="0.95" style={{ animation: "sb1 6.5s ease-in-out infinite 1s" }} />
            <circle cx="310" cy="615" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <circle cx="332" cy="600" r="1.5" fill="var(--text-primary)" opacity="0.65" style={{ animation: "sb3 7s ease-in-out infinite" }} />
            <circle cx="318" cy="575" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <circle cx="355" cy="588" r="1.3" fill="var(--text-primary)" opacity="0.55" style={{ animation: "sb4 5s ease-in-out infinite" }} />
            <circle cx="345" cy="628" r="1.4" fill="var(--text-primary)" opacity="0.6" />
            <circle cx="372" cy="640" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <text x="310" y="680" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--text-primary)" letterSpacing="2" style={{ animation: "lf 10s ease-in-out infinite 3s" }}>VIRGO</text>
          </g>

          {/* ══════ 15. DRACO — upper far right ══════ */}
          <g>
            <g stroke="rgba(240,237,232,0.22)" strokeWidth="0.8">
              <line x1="520" y1="140" x2="535" y2="165" />
              <line x1="535" y1="165" x2="528" y2="195" />
              <line x1="528" y1="195" x2="510" y2="215" />
              <line x1="510" y1="215" x2="520" y2="190" />
              <line x1="520" y1="140" x2="540" y2="132" />
              <line x1="540" y1="132" x2="535" y2="148" />
            </g>
            <circle cx="520" cy="140" r="1.5" fill="var(--text-primary)" opacity="0.65" style={{ animation: "sb1 6s ease-in-out infinite" }} />
            <circle cx="540" cy="132" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <circle cx="535" cy="148" r="1.3" fill="var(--text-primary)" opacity="0.55" />
            <circle cx="535" cy="165" r="1.4" fill="var(--text-primary)" opacity="0.6" style={{ animation: "sb3 7s ease-in-out infinite" }} />
            <circle cx="528" cy="195" r="6" fill="url(#gg)" style={{ animation: "gp3 8s ease-in-out infinite 2s" }} />
            <circle cx="528" cy="195" r="1.8" fill="#E8C84A" opacity="0.8" style={{ animation: "sb2 8s ease-in-out infinite 2s" }} />
            <circle cx="510" cy="215" r="1.3" fill="var(--text-primary)" opacity="0.55" style={{ animation: "sb4 5.5s ease-in-out infinite" }} />
            <text x="505" y="232" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--text-primary)" letterSpacing="2" style={{ animation: "lf 11s ease-in-out infinite 5s" }}>DRACO</text>
          </g>

          {/* ══════ SCATTERED FIELD STARS ══════ */}
          <g opacity="0.7">
            {[
              [30,50],[530,30],[30,850],[540,870],[280,25],[25,450],[545,450],[280,875],
              [120,55],[450,40],[40,250],[535,300],[50,650],[530,620],[180,830],[420,850],
              [80,180],[500,170],[60,550],[520,530],[350,820],[200,40],[400,30],[55,380],
              [530,400],[170,860],[380,870],[310,38],[310,862],[75,760],[505,780],
              [150,500],[410,580],[350,160],[200,700],[450,700],[100,400],[500,250],
              [250,550],[380,300],[160,280],[420,520],[300,740],[80,82],[490,85],
            ].map(([cx, cy], i) => (
              <circle key={`fs-${i}`} cx={cx} cy={cy} r={0.4 + (i % 4) * 0.2} fill="var(--text-primary)" opacity={0.15 + (i % 6) * 0.05} />
            ))}
          </g>
        </svg>
      </div>

      {/* ══════ METEORS — outside drift so they streak straight ══════ */}
      <svg
        viewBox="0 0 560 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="mg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--text-primary)" stopOpacity="0" />
            <stop offset="60%" stopColor="var(--text-primary)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--text-primary)" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <g style={{ animation: "meteor-streak 14s ease-in-out infinite 3s" }}>
          <line x1="350" y1="50" x2="395" y2="95" stroke="url(#mg)" strokeWidth="1.8" strokeLinecap="round" />
        </g>
        <g style={{ animation: "meteor-streak-2 20s ease-in-out infinite 10s" }}>
          <line x1="80" y1="430" x2="120" y2="470" stroke="url(#mg)" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      </svg>

      {/* Edge vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 85% 80% at 50% 45%, transparent 25%, rgba(14,14,17,0.92) 72%)",
        }}
      />
    </div>
  );
}
