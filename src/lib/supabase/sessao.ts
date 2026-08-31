import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { chavePublicavel, urlSupabase } from "@/lib/env";

const PUBLICAS = ["/login", "/recuperar-senha", "/nova-senha"];

export async function atualizarSessao(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    urlSupabase(),
    chavePublicavel(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Não colocar lógica entre createServerClient e esta chamada: a sessão
  // pode expirar no meio do request e o usuário cair para o login sem
  // motivo.
  //
  // getClaims() em vez de getUser(): o projeto assina em ES256, então a
  // assinatura é verificada localmente contra o JWKS em cache — sem ida à
  // rede em todo request. Ele ainda passa por getSession() por dentro, que
  // é quem renova o token vencido, então o refresh continua acontecendo.
  const { data: claims } = await supabase.auth.getClaims();
  const autenticado = Boolean(claims?.claims?.sub);

  const caminho = request.nextUrl.pathname;
  const ehPublica = PUBLICAS.some((p) => caminho.startsWith(p));

  if (!autenticado && !ehPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", caminho);
    return NextResponse.redirect(url);
  }

  if (autenticado && caminho === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/quadro";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
