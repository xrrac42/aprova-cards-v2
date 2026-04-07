import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

Deno.serve(async (req) => {
  console.log('=== WEBHOOK RECEBIDO ===');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Method:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate webhook token before processing
    const webhookToken = Deno.env.get('KIWIFY_WEBHOOK_TOKEN');
    const requestToken = req.headers.get('x-webhook-token');

    if (webhookToken && webhookToken !== requestToken) {
      console.log('❌ Token inválido ou ausente');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.text();
    console.log('Body raw:', rawBody);

    let body: any = {};
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.log('Body não é JSON válido');
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    console.log('Body parseado:', JSON.stringify(body, null, 2));

    // Extrair e-mail em diferentes formatos que a Kiwify pode enviar
    const email = (
      body?.Customer?.email ||
      body?.customer?.email ||
      body?.buyer?.email ||
      body?.data?.customer?.email ||
      ''
    )?.toLowerCase().trim();

    const kiwifyProductId = (
      body?.Product?.product_id ||
      body?.Product?.id ||
      body?.product?.product_id ||
      body?.product?.id ||
      body?.data?.product?.id ||
      body?.product_id ||
      ''
    );

    const event = (
      body?.webhook_event_type ||
      body?.order_status ||
      body?.status ||
      body?.event ||
      body?.type ||
      ''
    );

    console.log('Email extraído:', email);
    console.log('Product ID extraído:', kiwifyProductId);
    console.log('Evento extraído:', event);

    const isTest = body._teste === true;

    if (!isTest && !email) {
      console.log('Dados insuficientes — retornando 200 mesmo assim para não rejeitar');
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    if (!kiwifyProductId) {
      console.log('Product ID não encontrado no payload');
      if (isTest) {
        return new Response(JSON.stringify({ sucesso: false, erro: 'kiwify_product_id não informado no payload.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Busca o produto
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, mentor_id, name')
      .eq('kiwify_product_id', kiwifyProductId)
      .maybeSingle();

    console.log('Produto encontrado:', JSON.stringify(product));
    console.log('Erro na busca:', JSON.stringify(productError));

    if (!product) {
      console.log('Produto não encontrado para ID:', kiwifyProductId);
      if (isTest) {
        return new Response(JSON.stringify({
          sucesso: false,
          erro: `Produto não encontrado para kiwify_product_id: "${kiwifyProductId}". Verifique se o ID cadastrado está correto.`,
        }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response('ok', { status: 200, headers: corsHeaders });
    }

    // Se for teste, retorna validação sem cadastrar aluno
    if (isTest) {
      console.log('Modo teste — produto validado:', product.name);
      return new Response(JSON.stringify({
        sucesso: true,
        mensagem: 'Webhook validado com sucesso',
        produto: product.name,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Nota: A Kiwify não envia token nos headers — validação removida permanentemente

    // Log detalhado de evento
    console.log('=== VERIFICANDO EVENTO ===');
    console.log('Evento recebido:', event);

    const eventosAtivacao = ['paid', 'approved', 'complete', 'order_approved'];
    const eventosReembolso = [
      'order_refunded', 'refunded', 'pedido_reembolsado',
      'order_cancelled', 'cancelled', 'pedido_cancelado',
      'chargeback', 'chargedback', 'estorno', 'reembolso'
    ];

    console.log('É ativação?', eventosAtivacao.includes(event));
    console.log('É reembolso?', eventosReembolso.includes(event));

    // Ativar acesso
    if (eventosAtivacao.includes(event)) {
      console.log('=== ATIVANDO ACESSO ===');
      console.log('Email:', email);
      console.log('Product ID:', product.id);

      const { data: insertData, error: insertError } = await supabase
        .from('student_access')
        .upsert(
          { email, product_id: product.id, active: true, inactive_reason: null },
          { onConflict: 'email,product_id', ignoreDuplicates: false }
        )
        .select();

      console.log('Resultado insert:', JSON.stringify(insertData));
      console.log('Erro insert:', JSON.stringify(insertError));

      if (insertError) {
        console.error('FALHOU ao cadastrar aluno:', insertError.message);
        // Registra incidente de webhook
        await supabase.from('system_incidents').insert({
          type: 'webhook_failed',
          severity: 'critical',
          title: 'Falha ao cadastrar aluno via webhook',
          description: `Email: ${email} — Erro: ${insertError.message}`,
          metadata: { email, kiwifyProductId, event },
        });
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('student_access')
          .insert({ email, product_id: product.id, active: true })
          .select();
        console.log('Fallback insert resultado:', JSON.stringify(fallbackData));
        console.log('Fallback insert erro:', JSON.stringify(fallbackError));
      } else {
        console.log('✅ Aluno cadastrado com sucesso:', email);
      }
    }

    // Desativar acesso (reembolso/chargeback/cancelamento)
    if (eventosReembolso.includes(event)) {
      const chargebackEvents = ['chargeback', 'chargedback', 'estorno'];
      const inactiveReason = chargebackEvents.includes(event) ? 'chargeback' : 'refund';

      console.log('DESATIVANDO acesso para:', email, 'produto:', product.id, 'motivo:', inactiveReason);

      const { data: updateData, error: updateError } = await supabase
        .from('student_access')
        .update({ active: false, inactive_reason: inactiveReason })
        .eq('email', email)
        .eq('product_id', product.id)
        .select();

      console.log('Resultado da desativação:', JSON.stringify(updateData));
      if (updateError) console.error('Erro ao desativar:', JSON.stringify(updateError));
      else console.log('Acesso desativado com sucesso para:', email);
    }

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('Erro geral:', err);
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
});
