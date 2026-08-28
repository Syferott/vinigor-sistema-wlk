import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { FormularioCliente } from "../../formulario";
import type { Cliente } from "@/lib/types";

export const metadata = { title: "Editar cliente" };

export default async function EditarCliente({
  params,
}: PageProps<"/clientes/[id]/editar">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <>
      <CabecalhoPagina titulo={`Editar ${data.nome}`} />
      <Conteudo>
        <FormularioCliente cliente={data as Cliente} />
      </Conteudo>
    </>
  );
}
