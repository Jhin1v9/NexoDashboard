import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Shield, AlertTriangle, Globe, Monitor, Smartphone, Cpu,
  MapPin, Clock, Fingerprint, X, Filter, ChevronDown,
  Eye, Trash2, Lock, Wifi, Server, HardDrive,
  Navigation, Radio, Flag, AlertOctagon, Camera, Image,
  ShieldAlert, Ghost, ScanFace, Crosshair
} from 'lucide-react'

// Mapeamento de países para emoji de bandeira
const COUNTRY_FLAGS = {
  'Portugal': '🇵🇹', 'Spain': '🇪🇸', 'Brazil': '🇧🇷',
  'United States': '🇺🇸', 'United Kingdom': '🇬🇧',
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Italy': '🇮🇹',
  'Netherlands': '🇳🇱', 'Belgium': '🇧🇪',
  'Switzerland': '🇨🇭', 'Austria': '🇦🇹',
  'Poland': '🇵🇱', 'Czech Republic': '🇨🇿',
  'Hungary': '🇭🇺', 'Romania': '🇷🇴',
  'Bulgaria': '🇧🇬', 'Croatia': '🇭🇷',
  'Greece': '🇬🇷', 'Cyprus': '🇨🇾',
  'Malta': '🇲🇹', 'Ireland': '🇮🇪',
  'Denmark': '🇩🇰', 'Sweden': '🇸🇪',
  'Norway': '🇳🇴', 'Finland': '🇫🇮',
  'Iceland': '🇮🇸', 'Estonia': '🇪🇪',
  'Latvia': '🇱🇻', 'Lithuania': '🇱🇹',
  'Ukraine': '🇺🇦', 'Russia': '🇷🇺',
  'Turkey': '🇹🇷', 'Serbia': '🇷🇸',
  'Bosnia and Herzegovina': '🇧🇦', 'Montenegro': '🇲🇪',
  'North Macedonia': '🇲🇰', 'Albania': '🇦🇱',
  'Moldova': '🇲🇩', 'Belarus': '🇧🇾',
  'Georgia': '🇬🇪', 'Armenia': '🇦🇲',
  'Azerbaijan': '🇦🇿', 'Kazakhstan': '🇰🇿',
  'Uzbekistan': '🇺🇿',
  'China': '🇨🇳', 'Japan': '🇯🇵',
  'South Korea': '🇰🇷', 'India': '🇮🇳',
  'Pakistan': '🇵🇰', 'Bangladesh': '🇧🇩',
  'Sri Lanka': '🇱🇰', 'Nepal': '🇳🇵',
  'Afghanistan': '🇦🇫', 'Iran': '🇮🇷',
  'Iraq': '🇮🇶', 'Syria': '🇸🇾',
  'Lebanon': '🇱🇧', 'Jordan': '🇯🇴',
  'Israel': '🇮🇱', 'Palestine': '🇵🇸',
  'Saudi Arabia': '🇸🇦', 'Yemen': '🇾🇪',
  'Oman': '🇴🇲', 'United Arab Emirates': '🇦🇪',
  'Qatar': '🇶🇦', 'Bahrain': '🇧🇭',
  'Kuwait': '🇰🇼', 'Egypt': '🇪🇬',
  'Libya': '🇱🇾', 'Tunisia': '🇹🇳',
  'Algeria': '🇩🇿', 'Morocco': '🇲🇦',
  'Mauritania': '🇲🇷', 'Mali': '🇲🇱',
  'Niger': '🇳🇪', 'Chad': '🇹🇩',
  'Sudan': '🇸🇩', 'South Sudan': '🇸🇸',
  'Cameroon': '🇨🇲', 'Nigeria': '🇳🇬',
  'Benin': '🇧🇯', 'Togo': '🇹🇬',
  'Ghana': '🇬🇭', 'Ivory Coast': '🇨🇮',
  'Liberia': '🇱🇷', 'Sierra Leone': '🇸🇱',
  'Guinea': '🇬🇳', 'Guinea-Bissau': '🇬🇼',
  'Gambia': '🇬🇲', 'Senegal': '🇸🇳',
  'Cape Verde': '🇨🇻', 'Burkina Faso': '🇧🇫',
  'Equatorial Guinea': '🇬🇶', 'Gabon': '🇬🇦',
  'Congo': '🇨🇩', 'Democratic Republic of the Congo': '🇨🇩',
  'Angola': '🇦🇴', 'Zambia': '🇿🇲',
  'Zimbabwe': '🇿🇼', 'Malawi': '🇲🇼',
  'Mozambique': '🇲🇿', 'Madagascar': '🇲🇬',
  'Seychelles': '🇸🇨', 'Mauritius': '🇲🇺',
  'Comoros': '🇰🇲', 'South Africa': '🇿🇦',
  'Namibia': '🇳🇦', 'Botswana': '🇧🇼',
  'Lesotho': '🇱🇸', 'Eswatini': '🇸🇿',
  'Argentina': '🇦🇷', 'Chile': '🇨🇱',
  'Uruguay': '🇺🇾', 'Paraguay': '🇵🇾',
  'Bolivia': '🇧🇴', 'Peru': '🇵🇪',
  'Ecuador': '🇪🇨', 'Colombia': '🇨🇴',
  'Venezuela': '🇻🇪', 'Guyana': '🇬🇾',
  'Suriname': '🇸🇷', 'Panama': '🇵🇦',
  'Costa Rica': '🇨🇷', 'Nicaragua': '🇳🇮',
  'Honduras': '🇭🇳', 'El Salvador': '🇸🇻',
  'Guatemala': '🇬🇹', 'Belize': '🇧🇿',
  'Mexico': '🇲🇽', 'Cuba': '🇨🇺',
  'Jamaica': '🇯🇲', 'Haiti': '🇭🇹',
  'Dominican Republic': '🇩🇴', 'Puerto Rico': '🇵🇷',
  'Trinidad and Tobago': '🇹🇹', 'Barbados': '🇧🇧',
  'Saint Lucia': '🇱🇨', 'Saint Vincent and the Grenadines': '🇻🇨',
  'Grenada': '🇬🇩', 'Antigua and Barbuda': '🇦🇬',
  'Dominica': '🇩🇲', 'Saint Kitts and Nevis': '🇰🇳',
  'Bahamas': '🇧🇸', 'Canada': '🇨🇦',
  'Australia': '🇦🇺', 'New Zealand': '🇳🇿',
  'Fiji': '🇫🇯', 'Papua New Guinea': '🇵🇬',
  'Solomon Islands': '🇸🇧', 'Vanuatu': '🇻🇺',
  'Samoa': '🇼🇸', 'Tonga': '🇹🇴',
  'Kiribati': '🇰🇮', 'Tuvalu': '🇹🇻',
  'Nauru': '🇳🇷', 'Palau': '🇵🇼',
  'Marshall Islands': '🇲🇭', 'Micronesia': '🇫🇲',
  'Guam': '🇬🇺', 'Northern Mariana Islands': '🇲🇵',
  'American Samoa': '🇦🇸', 'Cook Islands': '🇨🇰',
  'French Polynesia': '🇵🇫', 'New Caledonia': '🇳🇨',
  'Wallis and Futuna': '🇼🇫', 'Norfolk Island': '🇳🇫',
  'Pitcairn Islands': '🇵🇳', 'Tokelau': '🇹🇰',
  'Niue': '🇳🇺', 'Cocos Islands': '🇨🇨',
  'Christmas Island': '🇨🇽', 'Antarctica': '🇦🇶',
  'Greenland': '🇬🇱', 'Faroe Islands': '🇫🇴',
  'Svalbard and Jan Mayen': '🇸🇯', 'Bouvet Island': '🇧🇻',
  'South Georgia and the South Sandwich Islands': '🇬🇸',
  'Falkland Islands': '🇫🇰',
  'British Indian Ocean Territory': '🇮🇴',
  'Cayman Islands': '🇰🇾', 'Bermuda': '🇧🇲',
  'Turks and Caicos Islands': '🇹🇨',
  'British Virgin Islands': '🇻🇬', 'Anguilla': '🇦🇮',
  'Montserrat': '🇲🇸', 'Saint Helena': '🇸🇽',
  'Gibraltar': '🇬🇮', 'Guernsey': '🇬🇬',
  'Jersey': '🇯🇪', 'Isle of Man': '🇮🇲',
  'Andorra': '🇦🇩', 'Monaco': '🇲🇨',
  'Liechtenstein': '🇱🇮', 'San Marino': '🇸🇲',
  'Vatican City': '🇻🇦', 'Luxembourg': '🇱🇺',
  'Singapore': '🇸🇬', 'Brunei': '🇧🇳',
  'Malaysia': '🇲🇾', 'Indonesia': '🇮🇩',
  'Philippines': '🇵🇭', 'Thailand': '🇹🇭',
  'Vietnam': '🇻🇳', 'Laos': '🇱🇦',
  'Cambodia': '🇰🇭', 'Myanmar': '🇲🇲',
  'Mongolia': '🇲🇳', 'North Korea': '🇰🇵',
  'Taiwan': '🇹🇼',
  'Rede Local': '🏠', 'Desconhecido': '❓', 'LAN': '🏠',
  'Servidor Local': '🏠', 'Private Network': '🏠', 'Local': '🏠'
};

function getCountryFlag(country) {
  if (!country) return '❓';
  return COUNTRY_FLAGS[country] || '🌐';
}

function isLocalIp(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  if (ip.startsWith('192.168.') || ip.startsWith('10.')) return true;
  if (ip.startsWith('169.254.') || ip.startsWith('fc00:') || ip.startsWith('fe80:')) return true;
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    if (parts.length >= 2) {
      const octet = parseInt(parts[1], 10);
      if (octet >= 16 && octet <= 31) return true;
    }
  }
  return false;
}

function isSuspiciousLocation(location) {
  if (!location || !location.country) return false;
  const suspicious = ['Russia', 'China', 'North Korea', 'Iran', 'Syria', 'Belarus', 'Myanmar', 'Cuba', 'Venezuela'];
  return suspicious.includes(location.country);
}

export default function Seguranca() {
  const [events, setEvents] = useState([])
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, failed_login, alert
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [stats, setStats] = useState({ total: 0, uniqueIps: 0, today: 0, alerted: 0, externalIps: 0 })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [logRes, settingsRes] = await Promise.all([
        axios.get('/api/security/log'),
        axios.get('/api/security/settings')
      ])
      const evts = logRes.data.events || []
      setEvents(evts)
      setSettings(settingsRes.data.settings || {})

      // Calcular estatísticas
      const uniqueIps = new Set(evts.map(e => e.ip)).size
      const today = evts.filter(e => {
        const d = new Date(e.timestamp)
        const now = new Date()
        return d.toDateString() === now.toDateString()
      }).length
      const alerted = evts.filter(e => e.notified).length
      const externalIps = evts.filter(e => !isLocalIp(e.ip)).length
      const anonymous = evts.filter(e => e.risk?.isAnonymous).length
      const evidences = evts.filter(e => e.hasCameraPhoto || e.hasScreenshot).length
      setStats({ total: evts.length, uniqueIps, today, alerted, externalIps, anonymous, evidences })
    } catch (e) {}
    setLoading(false)
  }

  const filteredEvents = events.filter(e => {
    if (filter === 'all') return true
    if (filter === 'alert') return e.notified
    if (filter === 'anonymous') return e.risk?.isAnonymous
    if (filter === 'evidence') return e.hasCameraPhoto || e.hasScreenshot
    return e.type === filter
  })

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20'
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20'
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
      default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    }
  }

  const getSeverityLabel = (severity) => {
    switch (severity) {
      case 'critical': return 'CRÍTICO'
      case 'high': return 'ALTO'
      case 'medium': return 'MÉDIO'
      default: return 'BAIXO'
    }
  }

  const formatDate = (ts) => {
    const d = new Date(ts)
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const deleteEvent = async (id) => {
    // No backend não tem delete individual, vamos filtrar no frontend
    setEvents(prev => prev.filter(e => e.id !== id))
    setSelectedEvent(null)
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-nexo-primary" />
          <div>
            <h1 className="text-2xl font-bold">Centro de Segurança</h1>
            <p className="text-sm text-nexo-muted">Monitoramento de ameaças e eventos de segurança</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-nexo-card border border-nexo-border rounded-lg text-sm hover:bg-nexo-bg transition-colors"
        >
          <Wifi className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Alert Banner — IPs externos */}
      {stats.externalIps > 0 && (
        <div className={`mb-4 p-4 rounded-xl border flex items-center gap-3 ${
          events.some(e => !isLocalIp(e.ip) && isSuspiciousLocation(e.location))
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-orange-500/10 border-orange-500/30 text-orange-400'
        }`}>
          <AlertOctagon className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold">
              {stats.externalIps} tentativa{stats.externalIps > 1 ? 's' : ''} de acesso detectada{stats.externalIps > 1 ? 's' : ''} de IPs externos
            </p>
            <p className="text-xs opacity-80">
              {events.some(e => !isLocalIp(e.ip) && isSuspiciousLocation(e.location))
                ? 'Atenção: origens de países de alto risco identificadas'
                : 'Monitoramento ativo — nenhuma origem de alto risco detectada'}
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-4 mb-6">
        {[
          { icon: AlertTriangle, label: 'Eventos Totais', value: stats.total, color: 'text-orange-400' },
          { icon: Globe, label: 'IPs Únicos', value: stats.uniqueIps, color: 'text-blue-400' },
          { icon: Clock, label: 'Hoje', value: stats.today, color: 'text-green-400' },
          { icon: Shield, label: 'Alertas Enviados', value: stats.alerted, color: 'text-red-400' },
          { icon: Radio, label: 'IPs Externos', value: stats.externalIps, color: 'text-amber-400' },
          { icon: Ghost, label: 'Anônimos', value: stats.anonymous, color: 'text-purple-400' },
          { icon: Camera, label: 'Evidências', value: stats.evidences, color: 'text-pink-400' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-nexo-muted uppercase">{s.label}</span>
            </div>
            <p className="text-2xl font-bold font-mono">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-nexo-muted" />
        {[
          { id: 'all', label: 'Todos' },
          { id: 'failed_login', label: 'Login Falho' },
          { id: 'alert', label: 'Com Alerta' },
          { id: 'anonymous', label: 'Anônimo' },
          { id: 'evidence', label: 'Com Evidências' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.id ? 'bg-nexo-primary text-white' : 'bg-nexo-card text-nexo-muted hover:text-nexo-text'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="text-xs text-nexo-muted ml-auto">{filteredEvents.length} eventos</span>
      </div>

      {/* Events Table */}
      {loading ? (
        <div className="glass-card p-8 text-center text-nexo-muted">Carregando...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3 text-nexo-muted opacity-30" />
          <p className="text-nexo-muted">Nenhum evento de segurança encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map(event => (
            <div
              key={event.id}
              className={`p-4 hover:border-nexo-primary/30 transition-all cursor-pointer rounded-xl border ${
                !isLocalIp(event.ip)
                  ? isSuspiciousLocation(event.location)
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-amber-500/5 border-amber-500/20'
                  : 'glass-card'
              }`}
              onClick={() => setSelectedEvent(event)}
            >
              <div className="flex items-start gap-4">
                {/* Severity Badge */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border ${getSeverityColor(event.severity)}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getSeverityColor(event.severity)}`}>
                      {getSeverityLabel(event.severity)}
                    </span>
                    {event.notified && (
                      <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                        ALERTA ENVIADO
                      </span>
                    )}
                    {event.risk?.isAnonymous && (
                      <span className="text-[10px] bg-purple-600/30 text-purple-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <Ghost className="w-3 h-3" />
                        ANÔNIMO
                      </span>
                    )}
                    {event.risk?.isVpn && (
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">VPN</span>
                    )}
                    {event.risk?.isTor && (
                      <span className="text-[10px] bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded">TOR</span>
                    )}
                    {event.risk?.isProxy && (
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded">PROXY</span>
                    )}
                    {event.risk?.isHosting && (
                      <span className="text-[10px] bg-slate-500/20 text-slate-400 px-2 py-0.5 rounded">HOSTING</span>
                    )}
                    {event.hasCameraPhoto && (
                      <span className="text-[10px] bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <Camera className="w-3 h-3" />
                        CÂMERA
                      </span>
                    )}
                    {event.hasScreenshot && (
                      <span className="text-[10px] bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <Image className="w-3 h-3" />
                        SCREEN
                      </span>
                    )}
                    {!isLocalIp(event.ip) && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <Radio className="w-3 h-3" />
                        IP EXTERNO
                      </span>
                    )}
                    {isSuspiciousLocation(event.location) && (
                      <span className="text-[10px] bg-red-600/30 text-red-400 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3" />
                        RISCO
                      </span>
                    )}
                    <span className="text-xs text-nexo-muted ml-auto">{formatDate(event.timestamp)}</span>
                  </div>

                  <p className="text-sm font-medium mt-1 truncate">{event.message}</p>

                  {/* Quick details */}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-nexo-muted">
                    <span className={`flex items-center gap-1 ${!isLocalIp(event.ip) ? 'text-amber-400 font-medium' : ''}`}>
                      <Globe className="w-3 h-3" />
                      {event.ip}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span className="text-base leading-none">{getCountryFlag(event.location?.country)}</span>
                      <span>{event.location?.city || '?'}, {event.location?.country || '?'}</span>
                    </span>
                    {event.location?.isp && !isLocalIp(event.ip) && (
                      <span className="flex items-center gap-1" title={event.location.isp}>
                        <Wifi className="w-3 h-3" />
                        <span className="max-w-[120px] truncate">{event.location.isp}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Monitor className="w-3 h-3" />
                      {event.device?.browser || '?'}
                    </span>
                    <span className="flex items-center gap-1">
                      <HardDrive className="w-3 h-3" />
                      {event.device?.os || '?'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      {event.device?.gpu || '?'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Fingerprint className="w-3 h-3" />
                      {event.device?.fingerprint?.slice(0, 8) || 'N/A'}...
                    </span>
                  </div>
                </div>

                <Eye className="w-4 h-4 text-nexo-muted flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedEvent(null)}>
          <div className="bg-nexo-card border border-nexo-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-nexo-border">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${getSeverityColor(selectedEvent.severity)}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">Detalhes do Evento</p>
                  <p className="text-xs text-nexo-muted">{selectedEvent.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => deleteEvent(selectedEvent.id)}
                  className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Remover do log"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 text-nexo-muted hover:bg-nexo-bg rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* General Info */}
              <div>
                <h3 className="text-sm font-bold text-nexo-primary mb-3 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Informações Gerais
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-nexo-bg rounded-lg p-3">
                    <p className="text-[10px] text-nexo-muted uppercase">Tipo</p>
                    <p className="text-sm font-medium">{selectedEvent.type === 'failed_login' ? 'Login Falho' : selectedEvent.type}</p>
                  </div>
                  <div className="bg-nexo-bg rounded-lg p-3">
                    <p className="text-[10px] text-nexo-muted uppercase">Severidade</p>
                    <p className="text-sm font-medium">{getSeverityLabel(selectedEvent.severity)}</p>
                  </div>
                  <div className="bg-nexo-bg rounded-lg p-3">
                    <p className="text-[10px] text-nexo-muted uppercase">Horário</p>
                    <p className="text-sm font-medium">{formatDate(selectedEvent.timestamp)}</p>
                  </div>
                  <div className="bg-nexo-bg rounded-lg p-3">
                    <p className="text-[10px] text-nexo-muted uppercase">Usuário Tentado</p>
                    <p className="text-sm font-medium">{selectedEvent.attemptedUser || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Risk Analysis */}
              {selectedEvent.risk && (
                <div>
                  <h3 className="text-sm font-bold text-purple-400 mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    Análise de Risco
                  </h3>
                  <div className="bg-nexo-bg rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">Conexão Anônima</span>
                      <span className={`text-sm font-bold ${selectedEvent.risk.isAnonymous ? 'text-purple-400' : 'text-green-400'}`}>
                        {selectedEvent.risk.isAnonymous ? 'SIM ⚠️' : 'Não'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">VPN</span>
                      <span className={`text-sm font-bold ${selectedEvent.risk.isVpn ? 'text-indigo-400' : 'text-nexo-muted'}`}>
                        {selectedEvent.risk.isVpn ? 'SIM' : 'Não'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">Tor</span>
                      <span className={`text-sm font-bold ${selectedEvent.risk.isTor ? 'text-violet-400' : 'text-nexo-muted'}`}>
                        {selectedEvent.risk.isTor ? 'SIM' : 'Não'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">Proxy</span>
                      <span className={`text-sm font-bold ${selectedEvent.risk.isProxy ? 'text-cyan-400' : 'text-nexo-muted'}`}>
                        {selectedEvent.risk.isProxy ? 'SIM' : 'Não'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">Hosting / Datacenter</span>
                      <span className={`text-sm font-bold ${selectedEvent.risk.isHosting ? 'text-slate-400' : 'text-nexo-muted'}`}>
                        {selectedEvent.risk.isHosting ? 'SIM' : 'Não'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">Threat Score</span>
                      <span className="text-sm font-mono font-bold">
                        {selectedEvent.risk.threatScore || 0}/100
                      </span>
                    </div>
                    {selectedEvent.risk.provider && (
                      <div className="flex justify-between">
                        <span className="text-sm text-nexo-muted">Provedor</span>
                        <span className="text-sm font-medium">{selectedEvent.risk.provider}</span>
                      </div>
                    )}
                    {selectedEvent.risk.asnType && (
                      <div className="flex justify-between">
                        <span className="text-sm text-nexo-muted">ASN Type</span>
                        <span className="text-sm font-medium">{selectedEvent.risk.asnType}</span>
                      </div>
                    )}
                    {selectedEvent.risk.source && (
                      <div className="flex justify-between">
                        <span className="text-sm text-nexo-muted">Fonte</span>
                        <span className="text-sm font-mono">{selectedEvent.risk.source}</span>
                      </div>
                    )}
                  </div>

                  {/* Heurísticas */}
                  {selectedEvent.risk.heuristics && Object.keys(selectedEvent.risk.heuristics).length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-bold text-nexo-muted uppercase mb-2">Heurísticas Locais</h4>
                      <div className="bg-nexo-bg rounded-lg p-3 space-y-1">
                        {selectedEvent.risk.heuristics.timezoneMismatch && (
                          <div className="flex items-center gap-2 text-xs text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            Timezone mismatch (browser vs IP)
                          </div>
                        )}
                        {selectedEvent.risk.heuristics.webrtcMismatch && (
                          <div className="flex items-center gap-2 text-xs text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            WebRTC IP leak mismatch
                          </div>
                        )}
                        {selectedEvent.risk.heuristics.headlessSuspect && (
                          <div className="flex items-center gap-2 text-xs text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            Navegador headless / automação suspeita
                          </div>
                        )}
                        {selectedEvent.risk.heuristics.langLocationMismatch && (
                          <div className="flex items-center gap-2 text-xs text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            Idioma vs Localização mismatch
                          </div>
                        )}
                        {selectedEvent.risk.heuristics.knownHostingProvider && (
                          <div className="flex items-center gap-2 text-xs text-amber-400">
                            <AlertTriangle className="w-3 h-3" />
                            Provedor de hosting conhecido
                          </div>
                        )}
                        {selectedEvent.risk.heuristics.webrtcPublicIps?.length > 0 && (
                          <div className="text-xs text-nexo-muted">
                            WebRTC IPs: {selectedEvent.risk.heuristics.webrtcPublicIps.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* IP & Location */}
              <div>
                <h3 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  IP & Localização
                </h3>

                {/* Alertas de localização */}
                {!isLocalIp(selectedEvent.ip) && (
                  <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span className="text-xs text-amber-400 font-medium">IP externo detectado — fora da rede local</span>
                  </div>
                )}
                {isSuspiciousLocation(selectedEvent.location) && (
                  <div className="mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="text-xs text-red-400 font-medium">Origem de país de alto risco identificada</span>
                  </div>
                )}

                <div className="bg-nexo-bg rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Endereço IP</span>
                    <span className={`text-sm font-mono font-medium ${!isLocalIp(selectedEvent.ip) ? 'text-amber-400' : ''}`}>
                      {selectedEvent.ip}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-nexo-muted">País</span>
                    <span className="text-sm font-medium flex items-center gap-2">
                      <span className="text-lg">{getCountryFlag(selectedEvent.location?.country)}</span>
                      {selectedEvent.location?.country || 'Desconhecido'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Cidade</span>
                    <span className="text-sm font-medium">{selectedEvent.location?.city || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Região</span>
                    <span className="text-sm font-medium">{selectedEvent.location?.region || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">ISP</span>
                    <span className="text-sm font-medium">{selectedEvent.location?.isp || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Organização</span>
                    <span className="text-sm font-medium">{selectedEvent.location?.org || 'Desconhecido'}</span>
                  </div>
                  {(selectedEvent.location?.lat && selectedEvent.location?.lon) && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-nexo-muted">Coordenadas</span>
                      <a
                        href={`https://www.google.com/maps?q=${selectedEvent.location.lat},${selectedEvent.location.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                      >
                        <Navigation className="w-3 h-3" />
                        {selectedEvent.location.lat}, {selectedEvent.location.lon}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Device Info */}
              <div>
                <h3 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  Dispositivo do Intruso
                </h3>
                <div className="bg-nexo-bg rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Navegador</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.browser || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Sistema Operacional</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.os || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Dispositivo</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.device || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Arquitetura</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.arch || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Tipo</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.isMobile ? 'Mobile' : 'Desktop'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Resolução de Tela</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.resolution || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">GPU / WebGL</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.gpu || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Idioma</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.language || 'Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-nexo-muted">Timezone</span>
                    <span className="text-sm font-medium">{selectedEvent.device?.timezone || 'Desconhecido'}</span>
                  </div>
                </div>
              </div>

              {/* Fingerprint Avançado */}
              <div>
                <h3 className="text-sm font-bold text-violet-400 mb-3 flex items-center gap-2">
                  <Fingerprint className="w-4 h-4" />
                  Fingerprint Digital
                </h3>
                <div className="bg-nexo-bg rounded-lg p-4 space-y-2">
                  <div>
                    <p className="text-xs text-nexo-muted mb-1">Canvas Hash</p>
                    <code className="block text-xs font-mono bg-black/30 p-2 rounded-lg break-all">
                      {selectedEvent.device?.fingerprintFull || selectedEvent.device?.fingerprint || 'N/A'}
                    </code>
                  </div>
                  {selectedEvent.device?.webrtc && selectedEvent.device.webrtc !== 'N/A' && (
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">WebRTC IPs</span>
                      <span className="text-sm font-mono">{Array.isArray(selectedEvent.device.webrtc) ? selectedEvent.device.webrtc.join(', ') : selectedEvent.device.webrtc}</span>
                    </div>
                  )}
                  {selectedEvent.device?.permissions && selectedEvent.device.permissions !== 'N/A' && (
                    <div>
                      <span className="text-sm text-nexo-muted">Permissions</span>
                      <code className="block text-[10px] font-mono bg-black/30 p-2 rounded-lg break-all mt-1">
                        {JSON.stringify(selectedEvent.device.permissions)}
                      </code>
                    </div>
                  )}
                  {selectedEvent.device?.performance && selectedEvent.device.performance !== 'N/A' && (
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">Hardware Cores</span>
                      <span className="text-sm font-mono">{selectedEvent.device.performance.hardwareConcurrency || 'N/A'}</span>
                    </div>
                  )}
                  {selectedEvent.device?.bluetooth && selectedEvent.device.bluetooth !== 'N/A' && (
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">Bluetooth API</span>
                      <span className="text-sm">{selectedEvent.device.bluetooth === true || selectedEvent.device.bluetooth === 'true' ? 'Disponível' : 'N/A'}</span>
                    </div>
                  )}
                  {selectedEvent.device?.usb && selectedEvent.device.usb !== 'N/A' && (
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">WebUSB</span>
                      <span className="text-sm">{selectedEvent.device.usb === true || selectedEvent.device.usb === 'true' ? 'Disponível' : 'N/A'}</span>
                    </div>
                  )}
                  {selectedEvent.device?.wakeLock && selectedEvent.device.wakeLock !== 'N/A' && (
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">Wake Lock</span>
                      <span className="text-sm">{selectedEvent.device.wakeLock === true || selectedEvent.device.wakeLock === 'true' ? 'Disponível' : 'N/A'}</span>
                    </div>
                  )}
                  {selectedEvent.device?.payment && selectedEvent.device.payment !== 'N/A' && (
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">Payment Request</span>
                      <span className="text-sm">{selectedEvent.device.payment === true || selectedEvent.device.payment === 'true' ? 'Disponível' : 'N/A'}</span>
                    </div>
                  )}
                  {selectedEvent.device?.credentials && selectedEvent.device.credentials !== 'N/A' && (
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">Credentials API</span>
                      <span className="text-sm">{selectedEvent.device.credentials === true || selectedEvent.device.credentials === 'true' ? 'Disponível' : 'N/A'}</span>
                    </div>
                  )}
                  {selectedEvent.device?.clipboard && selectedEvent.device.clipboard !== 'N/A' && (
                    <div className="flex justify-between">
                      <span className="text-sm text-nexo-muted">Clipboard</span>
                      <span className="text-sm font-mono">{JSON.stringify(selectedEvent.device.clipboard).slice(0, 60)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Evidências Visuais */}
              {(selectedEvent.hasCameraPhoto || selectedEvent.hasScreenshot) && (
                <div>
                  <h3 className="text-sm font-bold text-pink-400 mb-3 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Evidências Visuais
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedEvent.hasCameraPhoto && selectedEvent.cameraPhoto && (
                      <div>
                        <p className="text-xs text-nexo-muted mb-2 flex items-center gap-1">
                          <Camera className="w-3 h-3" /> Foto da Câmera
                        </p>
                        <img
                          src={selectedEvent.cameraPhoto}
                          alt="Foto do intruso"
                          className="w-full rounded-lg border border-nexo-border"
                          style={{ maxHeight: '300px', objectFit: 'contain' }}
                        />
                      </div>
                    )}
                    {selectedEvent.hasScreenshot && selectedEvent.screenshot && (
                      <div>
                        <p className="text-xs text-nexo-muted mb-2 flex items-center gap-1">
                          <Image className="w-3 h-3" /> Screenshot
                        </p>
                        <img
                          src={selectedEvent.screenshot}
                          alt="Screenshot do intruso"
                          className="w-full rounded-lg border border-nexo-border"
                          style={{ maxHeight: '300px', objectFit: 'contain' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Raw User-Agent */}
              <div>
                <h3 className="text-sm font-bold text-nexo-muted mb-3 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  User-Agent Completo
                </h3>
                <div className="bg-nexo-bg rounded-lg p-4">
                  <code className="block text-[10px] font-mono bg-black/30 p-3 rounded-lg break-all text-nexo-muted">
                    {selectedEvent.device?.userAgent || 'N/A'}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
