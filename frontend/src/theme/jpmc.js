/**
 * J.P. Morgan Theme — Light Edition
 * Salt Design System color palette
 *
 * Header : brown-300  rgb(215,186,157)
 * Body   : white
 * Accent : blue-500   rgb(0,120,207)   — JPM primary blue
 * Text   : gray-900   rgb(41,46,51)
 * Brown  : brown-700  rgb(103,63,27)   — JPM logo / accents
 */
const jpmc = {
  id:          'jpmc',
  bankName:    'J.P. Morgan',
  productName: 'Wealth Management',
  logoText:    'J.P.Morgan',
  tagline:     'Private Wealth Intelligence',

  colors: {
    bg:          '#ffffff',
    surface:     '#ffffff',
    surface2:    'rgb(248, 244, 239)',   // warm off-white
    surface3:    'rgb(243, 238, 232)',   // salt brown-100

    border:      'rgba(184, 138, 103, 0.25)',   // brown-400 subtle
    borderHover: 'rgba(184, 138, 103, 0.55)',

    accent:      'rgb(0, 120, 207)',     // salt blue-500
    accentDim:   'rgba(0, 120, 207, 0.1)',
    accentText:  'rgb(0, 69, 126)',      // salt blue-700

    gold:        'rgb(103, 63, 27)',     // salt brown-700
    goldDim:     'rgb(184, 138, 103)',   // salt brown-400

    success:     'rgb(0, 107, 72)',      // salt green-600
    danger:      'rgb(186, 23, 41)',     // salt red-600
    warning:     'rgb(158, 66, 0)',      // salt orange-600

    text:        'rgb(41, 46, 51)',      // salt gray-900
    muted:       'rgb(95, 100, 106)',    // salt gray-600
    faint:       'rgb(145, 149, 154)',   // salt gray-400

    adminGrad:   'linear-gradient(135deg, rgb(0,69,126), rgb(0,120,207))',
    agentGrad:   'linear-gradient(135deg, rgb(0,94,166), rgb(0,135,93))',
  },

  topbarBg:        'rgb(215, 186, 157)',  // salt brown-300
  topbarBorder:    'rgb(184, 138, 103)',  // salt brown-400

  userBubbleBg:    'rgb(0, 120, 207)',    // flat JPM blue
  userBubbleText:  '#ffffff',

  activeCardBg:    'rgba(0, 120, 207, 0.08)',
  activeCardBorder:'rgb(0, 120, 207)',
}

export default jpmc
