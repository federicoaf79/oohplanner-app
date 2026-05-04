import { useState, useMemo } from 'react'
import { ChevronDown, Search, BookOpen, Settings, DollarSign, Users, BarChart2, FileText, Shield, HelpCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

// ── Contenido FAQ por sección ─────────────────────────────────

const FAQ_SECTIONS = [
  {
    id:       'inventario',
    label:    'Inventario y carteles',
    icon:     BookOpen,
    color:    'text-brand',
    bg:       'bg-brand/10',
    roles:    ['owner', 'manager', 'salesperson'],
    items: [
      {
        q: '¿Cómo cargo un nuevo cartel al inventario?',
        a: 'Andá a Inventario → botón "Nuevo cartel". Completá los datos básicos (nombre, dirección, formato, medidas) y la tarifa mensual. Una vez guardado, podés enriquecer el cartel con fotos, zona de visión, costos CAPEX/OPEX y facilitadores asociados.',
        roles: ['owner', 'manager'],
      },
      {
        q: '¿Qué significa CAPEX y OPEX en cada cartel?',
        a: 'CAPEX es la inversión inicial en la estructura del cartel (fabricación, instalación, columnas, iluminación) — se amortiza en la cantidad de meses que definas. OPEX son los costos mensuales fijos de operación: alquiler del espacio, electricidad, mantenimiento, permisos e impuestos. El sistema usa estos valores para calcular el margen neto real por cartel.',
        roles: ['owner'],
      },
      {
        q: '¿Dónde cargo los costos mensuales de un cartel (alquiler, luz, impuestos)?',
        a: 'En Inventario → editá el cartel → tab "Financiero". Ahí encontrás los campos de OPEX: alquiler mensual del espacio, electricidad, mantenimiento, impuestos e imponderables. Todos se expresan en ARS y se usan para calcular el margen neto real en Reportes.',
        roles: ['owner'],
      },
      {
        q: '¿Cómo veo el margen neto de un cartel?',
        a: 'En Inventario cada tarjeta de cartel muestra el desglose: OPEX mensual, CAPEX amortizado y margen neto resultante. En Reportes → Rentabilidad encontrás el Top 5 de carteles más rentables y el detalle expandible por cartel con facturación acumulada, costos y utilidad.',
        roles: ['owner'],
      },
      {
        q: '¿Qué son los corredores y cómo los uso?',
        a: 'Los corredores son agrupaciones de carteles por calle o avenida (ej: "Corredor Panamericana", "Corredor 9 de Julio"). Se crean en Inventario → Corredores. Cada corredor tiene un color y aparece en el mapa. Sirven para armar propuestas geográficamente coherentes y para que el Planificador IA priorice carteles de un mismo corredor.',
        roles: ['owner', 'manager', 'salesperson'],
      },
      {
        q: '¿Cómo subo fotos masivas al inventario?',
        a: 'En Inventario → botón "Subir fotos ZIP". Comprimí las fotos en un archivo ZIP nombrando cada imagen con el código del cartel (ej: CAB-001.jpg) o su nombre exacto. El sistema hace el match automático y asigna las fotos a los carteles correspondientes.',
        roles: ['owner', 'manager'],
      },
      {
        q: '¿Qué es el Editor de Zonas?',
        a: 'El Editor de Zonas te permite marcar visualmente la superficie de anuncio en la foto de cada cartel. Esa marca se usa para generar los mockups fotorrealistas de las propuestas — donde se ve cómo quedaría la pieza gráfica del cliente en el cartel real.',
        roles: ['owner', 'manager'],
      },
      {
        q: '¿Qué es un cartel "placeholder"?',
        a: 'Un placeholder es un cartel que ya tiene acuerdo con un facilitador pero todavía no tiene todos los datos completos. Aparece en el inventario con una alerta ámbar. Podés vincularlo a un acuerdo desde Contactos → Acuerdos de facilitación. Una vez que tenés toda la información, completás los datos y queda como cartel normal.',
        roles: ['owner', 'manager'],
      },
    ],
  },
  {
    id:    'costos-comisiones',
    label: 'Costos y comisiones',
    icon:  DollarSign,
    color: 'text-amber-400',
    bg:    'bg-amber-500/10',
    roles: ['owner'],
    items: [
      {
        q: '¿Cómo funciona el sistema de comisiones?',
        a: 'Todas las comisiones se calculan sobre el precio de venta de cada cartel individual — que es el precio de lista menos el descuento aplicado en la propuesta. El porcentaje del vendedor está en su perfil. Los facilitadores externos y ocultos tienen su porcentaje configurado en cada cartel dentro de Inventario → Acuerdos. El sistema calcula automáticamente quién cobra qué al visualizar la tab Comisiones de una campaña.',
        roles: ['owner'],
      },
      {
        q: '¿Dónde configuro la comisión de cada vendedor?',
        a: 'En Configuración → Equipo → editá el perfil del vendedor. Ahí encontrás el campo "% de comisión". Este porcentaje aplica sobre el precio de venta de todo lo que venda ese vendedor, en cualquier campaña.',
        roles: ['owner'],
      },
      {
        q: '¿Dónde cargo los facilitadores de un cartel?',
        a: 'Hay dos caminos: (1) Contactos → Acuerdos de facilitación → creás el acuerdo con el contacto y configurás el % y el tipo (facilitador de locación o contrato de comercialización) → después asociás los carteles al acuerdo. (2) Inventario → Ajustes de Inventario → sección Facilitadores → podés vincular directamente un contacto a un cartel con su %. El sistema usa esos datos para calcular las comisiones en cada campaña.',
        roles: ['owner'],
      },
      {
        q: '¿Qué es un facilitador oculto?',
        a: 'Un facilitador oculto es alguien que cobra comisión en una operación pero cuya identidad no debe aparecer en ningún reporte visible para el equipo. Solo el dueño puede verlo. Se configura igual que un facilitador externo pero marcándolo como "oculto" en el tipo de comisión. Aparece en Reportes → Facilitadores con el label "(encubierta)".',
        roles: ['owner'],
      },
      {
        q: '¿Dónde veo el resumen de comisiones de una campaña?',
        a: 'En Campañas → abrís la campaña → tab "Comisiones". El sistema muestra automáticamente el desglose por cartel: precio de venta de cada soporte, comisión del vendedor, comisión de agencia y comisión de cada facilitador asociado. Es solo lectura — los datos vienen de la configuración del inventario y los perfiles.',
        roles: ['owner'],
      },
      {
        q: '¿Cómo veo el total de comisiones pagadas en un período?',
        a: 'En Reportes → tab "Facilitadores". Podés filtrar por período usando el selector de fechas. Muestra el total de comisiones, cuántos facilitadores externos estuvieron activos, comisiones internas (vendedores) y encubiertas. Si no hay comisiones registradas en ese período, el sistema muestra una estimación basada en las tasas configuradas en el inventario.',
        roles: ['owner'],
      },
      {
        q: '¿Cómo funciona la comisión de agencia?',
        a: 'La comisión de agencia se configura en cada cartel en Inventario → tab "Financiero" → campo "% comisión agencia". Se calcula sobre el precio de venta de ese cartel. No es un campo global — puede variar por cartel según el acuerdo con la agencia.',
        roles: ['owner'],
      },
    ],
  },
  {
    id:    'propuestas',
    label: 'Propuestas',
    icon:  FileText,
    color: 'text-violet-400',
    bg:    'bg-violet-500/10',
    roles: ['owner', 'manager', 'salesperson'],
    items: [
      {
        q: '¿Cómo creo una propuesta?',
        a: 'En Propuestas → "Nueva propuesta". El Planificador IA te guía en 3 pasos: (1) Brief del cliente — nombre, objetivo, presupuesto, fechas, zonas y audiencia target. (2) Estrategia — definís si priorizás impacto masivo, cobertura geográfica o segmentación por audiencia. (3) Resultado — el sistema selecciona los carteles más adecuados y genera la propuesta lista para descargar en PDF.',
        roles: ['owner', 'manager', 'salesperson'],
      },
      {
        q: '¿Puedo buscar un cliente existente al crear una propuesta?',
        a: 'Sí. En el Step 1 del Planificador, el campo "Nombre del cliente" tiene un buscador que consulta tu base de contactos mientras escribís. Al seleccionar un contacto existente, el nombre y el email se completan automáticamente. Si el cliente no está en la DB, simplemente escribís el nombre a mano.',
        roles: ['owner', 'manager', 'salesperson'],
      },
      {
        q: '¿Cómo aplico un descuento a una propuesta?',
        a: 'En el Step 3 del Planificador (Resultado) encontrás el campo "Descuento global %". Al aplicarlo, el precio de lista de todos los carteles se reduce proporcionalmente y el sistema muestra el nuevo total al cliente. El descuento tiene límites según tu rol — si superás el máximo configurado por el dueño, la propuesta queda en "pendiente de aprobación".',
        roles: ['owner', 'manager', 'salesperson'],
      },
      {
        q: '¿Qué pasa cuando una propuesta supera el descuento máximo?',
        a: 'Si el descuento aplicado supera el límite configurado para tu rol (owner o manager lo setean en Configuración → Ajustes de descuento), la propuesta queda en estado "Pendiente de aprobación" y le llega una alerta al dueño. El dueño puede aprobarla o rechazarla desde la sección Propuestas donde aparece con un badge ámbar.',
        roles: ['owner', 'manager', 'salesperson'],
      },
      {
        q: '¿Cómo apruebo una propuesta con descuento elevado?',
        a: 'En Propuestas verás las propuestas en estado "Pendiente de aprobación" con un banner ámbar. Como dueño o manager con permisos, hacés clic en "Aprobar" para que pase a estado "Enviada", o en "Rechazar" para que vuelva a borrador. También te llega la alerta en el ícono de campana en el header.',
        roles: ['owner', 'manager'],
      },
      {
        q: '¿Qué diferencia hay entre una propuesta y una campaña?',
        a: 'Una propuesta es el documento comercial que le presentás al cliente — tiene carteles, precios, fechas y un PDF para compartir. Cuando el cliente acepta y confirmás la venta, la propuesta pasa a estado "Aceptada" y se convierte en una campaña. La campaña es la operación activa: tiene costos de producción, certificaciones de instalación y el seguimiento post-venta.',
        roles: ['owner', 'manager', 'salesperson'],
      },
      {
        q: '¿Cómo genero el PDF de una propuesta para el cliente?',
        a: 'En el Step 3 del Planificador, hacé clic en "Descargar PDF cliente". Genera un documento profesional con el logo de tu empresa, los carteles seleccionados con fotos y ubicaciones, el mapa, los KPIs de audiencia y el precio total. También hay un "PDF owner" con el desglose confidencial de márgenes y comisiones, solo visible para el dueño.',
        roles: ['owner', 'manager', 'salesperson'],
      },
    ],
  },
  {
    id:    'campanas',
    label: 'Campañas y certificaciones',
    icon:  BarChart2,
    color: 'text-teal-400',
    bg:    'bg-teal-500/10',
    roles: ['owner', 'manager', 'salesperson'],
    items: [
      {
        q: '¿Cómo certifico la instalación de una campaña?',
        a: 'En Certificaciones → "Nueva certificación" → seleccionás la campaña. El sistema te muestra cada cartel de la campaña para que subas las fotos de instalación con fecha y hora automática. Una vez que todos los carteles tienen fotos, podés marcar la certificación como "Enviada". También podés descargar el PDF de certificación para entregar al cliente.',
        roles: ['owner', 'manager', 'salesperson'],
      },
      {
        q: '¿Qué son los costos de producción de una campaña?',
        a: 'Son los costos de impresión, colocación y diseño de la pieza gráfica. En Campañas → tab "Costos de Producción" podés configurar si estos costos se cobran al cliente (y en qué porcentaje) o los absorbe la empresa. Podés hacer un ajuste global para toda la campaña o personalizar cada cartel individualmente.',
        roles: ['owner', 'manager'],
      },
      {
        q: '¿Cómo veo el resumen financiero de una campaña?',
        a: 'En Campañas → abrís la campaña → tab "Resumen". Muestra la inversión del cliente, el vendedor asignado, las fechas de inicio y fin, y el resumen financiero con precio de lista, descuento aplicado y total final. Si tiene certificación, aparece el link para verla.',
        roles: ['owner', 'manager', 'salesperson'],
      },
    ],
  },
  {
    id:    'reportes',
    label: 'Reportes y analytics',
    icon:  BarChart2,
    color: 'text-blue-400',
    bg:    'bg-blue-500/10',
    roles: ['owner', 'manager'],
    items: [
      {
        q: '¿Cómo funciona el módulo de Reportes?',
        a: 'Reportes tiene 4 tabs: (1) Mi actividad — KPIs del período (facturación, propuestas, tasa de cierre, margen), evolución temporal, performance por vendedor y desglose de rentabilidad por cartel. (2) Rentabilidad — Top 5 carteles y Top 10 clientes más rentables. (3) Audiencias — tráfico diario y alcance de todo el inventario. (4) Facilitadores — resumen confidencial de comisiones (solo owner).',
        roles: ['owner', 'manager'],
      },
      {
        q: '¿Qué es la "Facturación" en los reportes?',
        a: 'La facturación es la suma del valor de todas las propuestas aceptadas en el período, contabilizada en la fecha en que se cerró la venta (accepted_at). No es el valor de la campaña a lo largo del tiempo — es el monto de la venta registrado en el mes en que se cerró, independientemente de la duración de la campaña.',
        roles: ['owner', 'manager'],
      },
      {
        q: '¿Cómo filtro los reportes por período?',
        a: 'Usá el selector de período en la parte superior de Reportes: Mes actual, Mes anterior, Últimos 3 meses, Últimos 6 meses o Año completo. Las tabs Rentabilidad, Audiencias y Facilitadores también respetan este filtro. Podés exportar los datos del período seleccionado en CSV con el botón "Exportar CSV".',
        roles: ['owner', 'manager'],
      },
      {
        q: '¿Qué es el margen de utilidad en Reportes?',
        a: 'El margen de utilidad es: (Facturación − OPEX del período − Comisiones) / Facturación × 100. El OPEX se calcula multiplicando los costos mensuales de cada cartel por los meses que estuvo en campaña. Las comisiones se calculan desde las tasas configuradas en el inventario y los perfiles.',
        roles: ['owner'],
      },
      {
        q: '¿Cómo veo la rentabilidad de un cartel específico?',
        a: 'En Reportes → tab "Mi actividad" → buscá el cartel en la tabla expandible al pie. Al hacer clic en un cartel, se expande mostrando: precio de lista, facturación acumulada del año, costos fijos mensuales, comisiones anuales y utilidad neta. Las campañas del cartel aparecen ordenadas de más reciente a más antigua con badge de mes.',
        roles: ['owner'],
      },
    ],
  },
  {
    id:    'equipo',
    label: 'Equipo y roles',
    icon:  Users,
    color: 'text-pink-400',
    bg:    'bg-pink-500/10',
    roles: ['owner', 'manager'],
    items: [
      {
        q: '¿Cuáles son los roles del sistema y qué puede hacer cada uno?',
        a: 'Hay 3 roles: (1) Dueño (owner) — acceso total, ve márgenes, comisiones, facilitadores, puede aprobar descuentos y configurar todo. (2) Gerente (manager) — puede gestionar propuestas, campañas y equipo; sus permisos para ver comisiones y aprobar descuentos los define el dueño. (3) Vendedor (salesperson) — crea propuestas y gestiona sus campañas; solo ve lo que le corresponde a él, con los límites de descuento configurados.',
        roles: ['owner', 'manager'],
      },
      {
        q: '¿Cómo invito a un nuevo miembro al equipo?',
        a: 'El nuevo miembro tiene que registrarse en OOH Planner usando el email de tu empresa. Una vez registrado, el dueño o gerente puede ir a Configuración → Equipo, buscar el usuario y asignarle el rol correspondiente. También podés configurar su % de comisión directamente desde esa pantalla.',
        roles: ['owner', 'manager'],
      },
      {
        q: '¿Cómo configuro los límites de descuento para vendedores y gerentes?',
        a: 'En Configuración → Ajustes → sección "Límites de descuento". Podés setear el porcentaje máximo que puede aplicar un vendedor y un gerente. Si alguno supera ese límite en una propuesta, el sistema la pone en "pendiente de aprobación" y te llega una alerta.',
        roles: ['owner'],
      },
      {
        q: '¿Puede un manager ver las comisiones y los facilitadores?',
        a: 'Solo si el dueño lo habilita explícitamente. En Configuración → Permisos de gerente podés activar o desactivar: ver asociados al cartel, ver facilitadores de venta, ver vendedores externos y ver comisiones del equipo. Por defecto, los managers no tienen acceso a esa información confidencial.',
        roles: ['owner'],
      },
    ],
  },
  {
    id:    'contactos',
    label: 'Contactos y acuerdos',
    icon:  Users,
    color: 'text-orange-400',
    bg:    'bg-orange-500/10',
    roles: ['owner', 'manager'],
    items: [
      {
        q: '¿Qué tipos de contactos existen en el sistema?',
        a: 'Los contactos se clasifican por rol: Clientes (anunciantes a quienes les vendés), Facilitadores (quienes te traen negocios o te dan acceso a locaciones), Agencias (intermediarias), Landlords (dueños de propiedades donde instalás carteles), Proveedores (impresión, instalación, diseño) y Otros. Un mismo contacto puede tener múltiples roles.',
        roles: ['owner', 'manager'],
      },
      {
        q: '¿Cómo cargo un facilitador y lo asocio a un cartel?',
        a: 'Paso 1: Contactos → "Nuevo contacto" → asignale el rol "Facilitador". Paso 2: Contactos → tab "Acuerdos de facilitación" → "Nuevo acuerdo" → elegís el contacto, el tipo de acuerdo, el % de comisión y la vigencia. Paso 3: Desde el detalle del acuerdo → "Agregar carteles" → seleccionás los carteles incluidos en ese acuerdo. El sistema usará esa configuración para calcular automáticamente las comisiones en cada campaña.',
        roles: ['owner'],
      },
      {
        q: '¿Qué es un Landlord y cómo lo asigno a un cartel?',
        a: 'Un Landlord es el propietario del espacio donde está instalado el cartel — quien te cobra el alquiler. Para asignarlo: primero cargalo en Contactos con el rol "Landlord". Después, en Inventario → editá el cartel → tab "Datos básicos" → campo "Landlord/Propietario" → seleccionás el contacto. Esto es obligatorio para carteles marcados como "Alquilado".',
        roles: ['owner', 'manager'],
      },
      {
        q: '¿Dónde veo todos los acuerdos activos con facilitadores?',
        a: 'En Contactos → tab "Acuerdos de facilitación". Aparecen todos los acuerdos con su estado (activo/inactivo), tipo, % de comisión, vigencia y cantidad de carteles asociados. Podés hacer clic en cualquiera para ver el detalle completo y los carteles vinculados.',
        roles: ['owner'],
      },
    ],
  },
  {
    id:    'configuracion',
    label: 'Configuración del sistema',
    icon:  Settings,
    color: 'text-slate-400',
    bg:    'bg-slate-500/10',
    roles: ['owner'],
    items: [
      {
        q: '¿Qué pasa con mis datos si termina el período de prueba?',
        a: 'Tus datos se conservan íntegramente. Podés seguir accediendo en modo lectura. Para retomar el uso completo, contactá al equipo de OOH Planner a través del módulo Soporte → Nuevo ticket.',
        roles: ['owner', 'manager', 'salesperson'],
      },
      {
        q: '¿Dónde configuro los datos de mi empresa?',
        a: 'En Configuración → Empresa. Podés actualizar el nombre, logo, dirección, teléfono, horarios de atención, sitio web y datos de facturación. El logo aparece en todos los PDFs generados para clientes.',
        roles: ['owner'],
      },
      {
        q: '¿Cómo configuro los costos estándar de producción (impresión, colocación, diseño)?',
        a: 'En Configuración → Ajustes de producción. Podés definir el costo por m² de impresión y colocación, y si la empresa tiene diseñador interno (con su precio por cartel) o externo (costo/hora + markup). Estos valores se usan como base en cada campaña y el manager puede ajustarlos por operación.',
        roles: ['owner'],
      },
      {
        q: '¿Cómo configuro qué puede ver un Gerente?',
        a: 'En Configuración → Permisos de Gerente. Hay 4 permisos que podés activar/desactivar individualmente: ver asociados del cartel, ver facilitadores de venta, ver vendedores externos y ver comisiones del equipo. Todos están desactivados por defecto — el dueño los habilita según la confianza y responsabilidad de cada manager.',
        roles: ['owner'],
      },
    ],
  },
]

// ── Componente principal ──────────────────────────────────────

export default function FAQ() {
  const { profile } = useAuth()
  const role = profile?.role ?? 'salesperson'

  const [search,          setSearch]          = useState('')
  const [activeSection,   setActiveSection]   = useState('all')
  const [activeRoleFilter, setActiveRoleFilter] = useState('all')  // all | owner | manager | salesperson

  // Filtrar secciones según rol del usuario
  const visibleSections = FAQ_SECTIONS.filter(s => s.roles.includes(role))

  // Filtrar items
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return visibleSections.map(section => {
      const items = section.items.filter(item => {
        // Filtro de rol del FAQ (owner vs operativo)
        if (activeRoleFilter !== 'all' && !item.roles.includes(activeRoleFilter)) return false
        // Filtro de sección
        if (activeSection !== 'all' && section.id !== activeSection) return false
        // Búsqueda
        if (!q) return true
        return item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      })
      return { ...section, items }
    }).filter(s => s.items.length > 0)
  }, [search, activeSection, activeRoleFilter, visibleSections])

  const totalItems = filtered.reduce((s, sec) => s + sec.items.length, 0)

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in pb-16">

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">Centro de ayuda</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Encontrá respuestas sobre el uso del sistema según tu rol
        </p>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar en el centro de ayuda…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-10 w-full"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filtros de sección */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="Todo"
          active={activeSection === 'all'}
          onClick={() => setActiveSection('all')}
        />
        {visibleSections.map(s => (
          <FilterChip
            key={s.id}
            label={s.label}
            active={activeSection === s.id}
            onClick={() => setActiveSection(activeSection === s.id ? 'all' : s.id)}
          />
        ))}
      </div>

      {/* Filtro por tipo de usuario (solo visible para owner) */}
      {role === 'owner' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 shrink-0">Filtrar por perfil:</span>
          {[
            { id: 'all',         label: 'Todos' },
            { id: 'owner',       label: 'Solo dueño' },
            { id: 'manager',     label: 'Gerente' },
            { id: 'salesperson', label: 'Vendedor' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveRoleFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeRoleFilter === f.id
                  ? 'bg-brand text-white'
                  : 'bg-surface-700 text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Resultado de búsqueda */}
      {search && (
        <p className="text-xs text-slate-500">
          {totalItems === 0 ? 'Sin resultados para' : `${totalItems} resultado${totalItems !== 1 ? 's' : ''} para`}{' '}
          <span className="text-slate-300">"{search}"</span>
        </p>
      )}

      {/* Secciones */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <HelpCircle className="h-10 w-10 text-slate-700 mb-3" />
          <p className="text-slate-400 font-medium">Sin resultados</p>
          <p className="text-xs text-slate-600 mt-1">Intentá con otras palabras o abrí un ticket de soporte</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map(section => {
            const Icon = section.icon
            return (
              <div key={section.id} className="space-y-2">
                {/* Encabezado de sección */}
                {(activeSection === 'all' || filtered.length > 1) && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${section.bg}`}>
                      <Icon className={`h-4 w-4 ${section.color}`} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-300">{section.label}</h3>
                    <span className="text-xs text-slate-600">({section.items.length})</span>
                  </div>
                )}

                <div className="divide-y divide-surface-700 rounded-xl border border-surface-700 overflow-hidden">
                  {section.items.map((item, i) => (
                    <FAQItem
                      key={i}
                      question={item.q}
                      answer={item.a}
                      roles={item.roles}
                      currentRole={role}
                      highlight={search}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Link a soporte */}
      <div className="rounded-xl border border-surface-700 bg-surface-800/40 px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">¿No encontrás lo que buscás?</p>
          <p className="text-xs text-slate-500 mt-0.5">Abrí un ticket y te respondemos a la brevedad</p>
        </div>
        <a
          href="/app/support"
          className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 transition-colors"
        >
          Ir a Soporte
        </a>
      </div>
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-brand text-white'
          : 'bg-surface-700 text-slate-400 hover:text-white hover:bg-surface-600'
      }`}
    >
      {label}
    </button>
  )
}

function FAQItem({ question, answer, roles, currentRole, highlight }) {
  const [open, setOpen] = useState(false)

  function highlightText(text) {
    if (!highlight || highlight.length < 2) return text
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part)
        ? <mark key={i} className="bg-brand/30 text-white rounded px-0.5">{part}</mark>
        : part
    )
  }

  // Badge de rol — solo visible para owners
  const isOwnerOnly = roles.length === 1 && roles[0] === 'owner'

  return (
    <div className="bg-surface-800">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-start justify-between gap-4 px-4 py-3.5 text-left hover:bg-surface-700/50 transition-colors"
      >
        <div className="flex items-start gap-2 min-w-0">
          {isOwnerOnly && (
            <span className="shrink-0 mt-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs font-medium text-amber-400">
              Dueño
            </span>
          )}
          <span className="text-sm font-medium text-slate-200 leading-snug">
            {highlightText(question)}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 mt-0.5 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-surface-700 px-4 py-3.5">
          <p className="text-sm leading-relaxed text-slate-400">
            {highlightText(answer)}
          </p>
        </div>
      )}
    </div>
  )
}
