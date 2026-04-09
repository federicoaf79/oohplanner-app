# Deploy de la Edge Function `plan-pauta`

## 1. Instalar Supabase CLI

```bash
# macOS / Linux
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# O con npm (cualquier OS)
npm install -g supabase
```

Verificar instalación:
```bash
supabase --version
```

---

## 2. Login

```bash
supabase login
```

Se abre el navegador para autenticarse con tu cuenta de Supabase.

---

## 3. Obtener el Project Reference

1. Ir a **app.supabase.com** → tu proyecto
2. Settings → General → **Reference ID**  
   Ejemplo: `abcdefghijklmnop`

---

## 4. Linkar el proyecto (primera vez)

```bash
cd C:/oohplanner-app
supabase link --project-ref TU_PROJECT_REF
```

---

## 5. Configurar el secret de Anthropic

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...
```

Verificar que quedó guardado:
```bash
supabase secrets list
```

---

## 6. Deployar la Edge Function

```bash
supabase functions deploy plan-pauta --project-ref TU_PROJECT_REF
```

Si usás Deno sin instalarlo localmente, agregar `--no-verify-jwt` solo para pruebas:
```bash
supabase functions deploy plan-pauta --project-ref TU_PROJECT_REF --no-verify-jwt
```

> **Nota:** La función lee `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` automáticamente
> desde el entorno de Supabase. Solo necesitás setear `ANTHROPIC_API_KEY`.

---

## 7. Verificar que funciona

### Opción A — Desde el frontend

1. Ir a Vercel → Settings → Environment Variables
2. Agregar (o verificar): `VITE_USE_MOCK_AI` = `false` (o simplemente no ponerla — el default ya es real)
3. Redeploy

### Opción B — Curl directo

```bash
curl -X POST \
  https://TU_PROJECT_REF.supabase.co/functions/v1/plan-pauta \
  -H "Authorization: Bearer TU_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "TU_ORG_UUID",
    "formData": {
      "clientName": "Test",
      "objective": "awareness",
      "formats": ["billboard", "digital"],
      "provinces": ["CABA"],
      "cities": ["Buenos Aires (CABA)"],
      "budget": "500000",
      "discountPct": 10,
      "startDate": "2026-05-01",
      "endDate": "2026-05-31",
      "audience": { "ageMin": 25, "ageMax": 45, "gender": "all" }
    }
  }'
```

Respuesta esperada: JSON con `optionA`, `optionB`, `audience_mode`.

---

## 8. Ejecutar la migration SQL

En **Supabase Dashboard → SQL Editor**, ejecutar el contenido de:
```
supabase/migration_v4.sql
```

Esto crea la tabla `corridors` con su política RLS.

---

## 9. Troubleshooting

| Error | Causa | Solución |
|-------|-------|----------|
| `ANTHROPIC_API_KEY no configurado` | Secret no seteado | `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` |
| `No hay carteles disponibles` | Inventario sin ítems disponibles en esa ciudad/formato | Verificar `is_available=true` en inventario, y que las ciudades del form coincidan |
| `La IA no devolvió JSON válido` | Respuesta malformada de Claude | Reintentá — suele ser transitorio |
| `DB error: ...` | Query a Supabase falló | Verificar `SUPABASE_SERVICE_ROLE_KEY` en el entorno |
| 401 Unauthorized | JWT inválido | Verificar que el cliente Supabase tenga la sesión activa |
