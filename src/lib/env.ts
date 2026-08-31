/**
 * Leitura das variáveis de ambiente com erro legível.
 *
 * Sem isto, faltar uma variável em produção vira "Internal Server Error"
 * em toda rota, e no log só aparece "Your project's URL and Key are
 * required to create a Supabase client!" — que não diz qual variável
 * falta nem onde configurá-la.
 *
 * Atenção ao NEXT_PUBLIC_: essas variáveis são embutidas no bundle
 * durante o build. Adicioná-las na Vercel não basta — é preciso
 * *refazer o deploy*, senão o bundle antigo continua com undefined.
 */
function exigir(nome: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(
      `Variável de ambiente ausente: ${nome}. ` +
        `Configure em Vercel → Settings → Environment Variables (ou no .env.local, ` +
        `em desenvolvimento) e refaça o deploy. Veja .env.example.`,
    );
  }
  return valor;
}

export function urlSupabase(): string {
  return exigir("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function chavePublicavel(): string {
  return exigir(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function chaveServico(): string {
  return exigir(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Origem pública do site, usada no link de recuperação de senha. */
export function urlSite(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
