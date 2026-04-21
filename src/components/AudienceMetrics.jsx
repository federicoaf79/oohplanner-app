// Componente: AudienceMetrics
// Path: src/components/AudienceMetrics.jsx

import React from 'react';

export default function AudienceMetrics({ data, loading = false }) {
  if (loading) {
    return (
      <div className="audience-metrics-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-slate-200 rounded"></div>
            <div className="h-24 bg-slate-200 rounded"></div>
            <div className="h-24 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.aggregate) {
    return null;
  }

  const { aggregate, by_billboard } = data;

  // Calcular breakdown promedio de todos los carteles
  const avgDemographics = calculateAverageDemographics(by_billboard);

  return (
    <div className="audience-metrics bg-slate-800/50 rounded-lg shadow-sm border border-slate-700 p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-700 pb-4">
        <h3 className="text-lg font-semibold text-slate-100">
          📊 Alcance de Audiencia
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Estimación basada en datos de Censo 2022 y patrones de movilidad urbana
        </p>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          label="Alcance Semanal"
          value={aggregate.unique_weekly_reach.toLocaleString()}
          unit="personas únicas"
          highlight={true}
          icon="👥"
        />
        <MetricCard
          label="Frecuencia Promedio"
          value={aggregate.avg_frequency.toFixed(1)}
          unit="veces por persona"
          icon="🔄"
        />
        <MetricCard
          label="Impresiones Totales"
          value={aggregate.total_impressions.toLocaleString()}
          unit="visualizaciones"
          icon="👁️"
        />
      </div>

      {/* Breakdown demográfico */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-slate-100">
          Composición de Audiencia
        </h4>

        {/* Edad */}
        {avgDemographics.age && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">
              Distribución por Edad
            </label>
            <div className="space-y-1">
              {Object.entries(avgDemographics.age)
                .sort((a, b) => b[1] - a[1])
                .map(([ageGroup, percentage]) => (
                  <BarItem
                    key={ageGroup}
                    label={formatAgeGroup(ageGroup)}
                    value={percentage}
                    color="bg-blue-500"
                  />
                ))}
            </div>
          </div>
        )}

        {/* NSE */}
        {avgDemographics.nse && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">
              Nivel Socioeconómico
            </label>
            <div className="flex gap-2">
              {Object.entries(avgDemographics.nse)
                .sort((a, b) => b[1] - a[1])
                .map(([nse, percentage]) => (
                  <NSEPill
                    key={nse}
                    label={nse.toUpperCase()}
                    percentage={percentage}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Afinidad con intereses */}
        {avgDemographics.interests && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400">
              Afinidad con Intereses Seleccionados
            </label>
            <div className="space-y-1">
              {Object.entries(avgDemographics.interests)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([interest, score]) => (
                  <InterestScore
                    key={interest}
                    name={formatInterestName(interest)}
                    score={score}
                  />
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Info adicional */}
      <div className="border-t border-slate-700 pt-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {aggregate.total_billboards} cartel{aggregate.total_billboards !== 1 ? 'es' : ''} analizados
          </span>
          <span>
            Factor deduplicación: 15%
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTES
// ============================================================

function MetricCard({ label, value, unit, highlight = false, icon }) {
  return (
    <div
      className={`rounded-lg p-4 ${
        highlight
          ? 'bg-gradient-to-br from-blue-900/30 to-blue-800/30 border-2 border-blue-700/50'
          : 'bg-slate-800 border border-slate-700'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-lg">{icon}</span>}
        <label className="text-xs font-medium text-slate-400">{label}</label>
      </div>
      <div className="space-y-1">
        <div
          className={`text-2xl font-bold ${
            highlight ? 'text-blue-300' : 'text-slate-100'
          }`}
        >
          {value}
        </div>
        <div className="text-xs text-slate-500">{unit}</div>
      </div>
    </div>
  );
}

function BarItem({ label, value, color }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-500`}
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="text-xs font-medium text-slate-100 w-12 text-right">
          {value.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function NSEPill({ label, percentage }) {
  const colorMap = {
    ABC1: 'bg-teal-100 text-teal-700 border-teal-200',
    C2: 'bg-blue-100 text-blue-700 border-blue-200',
    C3: 'bg-amber-100 text-amber-700 border-amber-200'
  };

  const color = colorMap[label] || 'bg-slate-700 text-slate-100 border-slate-600';

  return (
    <div className={`flex-1 rounded-lg border px-3 py-2 ${color}`}>
      <div className="text-xs font-semibold">{label}</div>
      <div className="text-lg font-bold mt-1">{percentage.toFixed(1)}%</div>
    </div>
  );
}

function InterestScore({ name, score }) {
  const getScoreLabel = (score) => {
    if (score >= 0.7) return { text: '🔥 Alta', color: 'text-orange-600' };
    if (score >= 0.5) return { text: '✓ Media', color: 'text-blue-600' };
    return { text: '○ Baja', color: 'text-slate-400' };
  };

  const scoreLabel = getScoreLabel(score);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-32 flex-shrink-0">{name}</span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              score >= 0.7
                ? 'bg-gradient-to-r from-orange-400 to-orange-600'
                : score >= 0.5
                ? 'bg-blue-500'
                : 'bg-slate-300'
            }`}
            style={{ width: `${score * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${scoreLabel.color} w-20`}>
          {scoreLabel.text}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

function calculateAverageDemographics(billboards) {
  if (!billboards || billboards.length === 0) {
    return {};
  }

  const totalReach = billboards.reduce((sum, b) => sum + b.filtered_daily_reach, 0);

  // Promediar demográficos ponderado por alcance
  const avgAge = {};
  const avgNSE = {};
  const avgInterests = {};

  billboards.forEach(billboard => {
    const weight = billboard.filtered_daily_reach / totalReach;
    const demo = billboard.demographic_breakdown || {};
    const interests = billboard.interest_scores || {};

    // Edad
    if (demo.age) {
      Object.entries(demo.age).forEach(([group, pct]) => {
        avgAge[group] = (avgAge[group] || 0) + pct * weight;
      });
    }

    // NSE
    if (demo.nse) {
      Object.entries(demo.nse).forEach(([level, pct]) => {
        avgNSE[level] = (avgNSE[level] || 0) + pct * weight;
      });
    }

    // Intereses
    Object.entries(interests).forEach(([interest, score]) => {
      avgInterests[interest] = (avgInterests[interest] || 0) + score * weight;
    });
  });

  return {
    age: avgAge,
    nse: avgNSE,
    interests: avgInterests
  };
}

function formatAgeGroup(group) {
  const map = {
    '18_24': '18-24 años',
    '25_34': '25-34 años',
    '35_44': '35-44 años',
    '45_54': '45-54 años',
    '55_plus': '55+ años'
  };
  return map[group] || group;
}

function formatInterestName(key) {
  const map = {
    tecnologia: 'Tecnología',
    gastronomia: 'Gastronomía',
    salud_bienestar: 'Salud & Bienestar',
    retail: 'Retail & Consumo',
    automovilismo: 'Automovilismo',
    finanzas: 'Finanzas',
    moda: 'Moda & Estilo',
    entretenimiento: 'Entretenimiento'
  };
  return map[key] || key;
}
