import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const incidents: Array<{ type: string; severity: string; title: string; description: string; metadata?: Record<string, unknown> }> = [];
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Webhook failures (last 24h)
  const { data: webhookFails } = await supabase
    .from('system_incidents')
    .select('id')
    .eq('type', 'webhook_failed')
    .eq('resolved', false)
    .gte('created_at', last24h);

  if (webhookFails && webhookFails.length >= 3) {
    incidents.push({
      type: 'webhook_failed',
      severity: 'critical',
      title: `🚨 ${webhookFails.length} falhas de webhook nas últimas 24h`,
      description: 'Alunos podem não estar recebendo acesso após compra.',
    });
  }

  // 2. Login failures (last 24h)
  const { data: loginFails } = await supabase
    .from('system_incidents')
    .select('id')
    .eq('type', 'login_failed')
    .eq('resolved', false)
    .gte('created_at', last24h);

  if (loginFails && loginFails.length >= 5) {
    incidents.push({
      type: 'login_failed',
      severity: 'warning',
      title: `⚠️ ${loginFails.length} falhas de login nas últimas 24h`,
      description: 'Vários alunos com dificuldade para acessar o sistema.',
    });
  }

  // 3. Inactive students (bought but never studied, > 3 days)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: allActive } = await supabase
    .from('student_access')
    .select('email, product_id, created_at')
    .eq('active', true)
    .lt('created_at', threeDaysAgo);

  if (allActive && allActive.length > 0) {
    const [{ data: activeStudents }, { data: exceptions }] = await Promise.all([
      supabase.from('student_sessions').select('student_email'),
      supabase.from('health_check_exceptions').select('reference_key').eq('type', 'inactive_student'),
    ]);

    const activeEmails = new Set((activeStudents || []).map((s: any) => s.student_email));
    const exceptionEmails = new Set((exceptions || []).map((e: any) => e.reference_key));

    const inativos = allActive.filter(a => !activeEmails.has(a.email) && !exceptionEmails.has(a.email));

    if (inativos.length > 0) {
      incidents.push({
        type: 'inactive_student',
        severity: 'warning',
        title: `📊 ${inativos.length} aluno(s) nunca acessaram após a compra`,
        description: inativos.slice(0, 10).map(a => a.email).join(', ') +
          (inativos.length > 10 ? ` e mais ${inativos.length - 10}...` : ''),
        metadata: { count: inativos.length, emails: inativos.map(a => a.email) },
      });
    }
  }

  // 4. Health score
  let score = 100;
  incidents.forEach(i => {
    if (i.type === 'webhook_failed') score -= 30;
    else if (i.type === 'login_failed' && (loginFails?.length || 0) >= 10) score -= 20;
    else if (i.type === 'login_failed') score -= 10;
    else if (i.type === 'inactive_student') score -= 5;
  });
  score = Math.max(0, score);

  // 5. Save new incidents — with dedup check
  for (const incident of incidents) {
    const { data: existing } = await supabase
      .from('system_incidents')
      .select('id')
      .eq('type', incident.type)
      .eq('resolved', false)
      .gte('created_at', last24h)
      .maybeSingle();

    if (!existing) {
      await supabase.from('system_incidents').insert(incident);
    }
  }

  // 6. Gather extra metrics
  const todayDate = new Date().toISOString().split('T')[0];

  const [
    { count: activeStudentsToday },
    { count: sessionsToday },
    { data: lastCritical },
    { data: cardsData },
  ] = await Promise.all([
    supabase.from('student_sessions').select('student_email', { count: 'exact', head: true }).gte('session_date', todayDate),
    supabase.from('student_sessions').select('*', { count: 'exact', head: true }).gte('session_date', todayDate),
    supabase.from('system_incidents').select('created_at').eq('severity', 'critical').eq('resolved', false).order('created_at', { ascending: false }).limit(1),
    supabase.from('student_sessions').select('cards_reviewed').gte('session_date', todayDate),
  ]);

  const cardsStudiedToday = (cardsData || []).reduce((sum: number, s: any) => sum + (s.cards_reviewed || 0), 0);

  const lastCriticalDate = lastCritical?.[0]?.created_at;
  const uptimeHours = lastCriticalDate
    ? Math.round((Date.now() - new Date(lastCriticalDate).getTime()) / (1000 * 60 * 60))
    : null;

  const metrics = {
    active_students_today: activeStudentsToday || 0,
    cards_studied_today: cardsStudiedToday,
    sessions_today: sessionsToday || 0,
    uptime_hours: uptimeHours,
  };

  return new Response(JSON.stringify({ score, incidents_count: incidents.length, incidents, metrics }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
