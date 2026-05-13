/**
 * HSBC Theme
 * Brand: HSBC Red + Black + White
 */
const hsbc = {
  id: 'hsbc',
  bankName: 'HSBC',
  productName: 'Private Banking Assistant',
  logo: '🔴',
  logoText: 'HSBC',
  tagline: 'Global Wealth Management',
  favicon: '🏦',

  colors: {
    /* Backgrounds */
    bg:        '#0a0707',
    surface:   '#140c0c',
    surface2:  '#1e1010',
    surface3:  '#2a1515',

    /* Borders */
    border:    '#3d1a1a',
    borderHover:'#5c2a2a',

    /* Brand */
    accent:    '#db0011',          // HSBC red
    accentDim: '#7a0009',
    accentText:'#ff5566',

    /* Gold accent — HSBC uses black/white, secondary warm */
    gold:      '#c8a96e',
    goldDim:   '#6e4d1a',

    /* Semantic */
    success:   '#1a9e5c',
    danger:    '#ff3333',
    warning:   '#c8a96e',

    /* Text */
    text:      '#f5e8e8',
    muted:     '#c09090',
    faint:     '#7a5050',

    /* Role avatars */
    adminGrad: 'linear-gradient(135deg, #7a0009, #db0011)',
    agentGrad: 'linear-gradient(135deg, #db0011, #8b0000)',
  },

  /* Topbar gradient */
  topbarBg:  'linear-gradient(90deg, #0a0707 0%, #1e0a0a 60%, #140c0c 100%)',
  topbarBorder: '#3d1a1a',

  /* Chat bubble */
  userBubbleBg:  'linear-gradient(135deg, #db0011, #7a0009)',
  userBubbleText:'#ffffff',

  /* Sidebar highlight */
  activeCardBg:  '#2a0a0a',
  activeCardBorder: '#db0011',
}

export default hsbc
