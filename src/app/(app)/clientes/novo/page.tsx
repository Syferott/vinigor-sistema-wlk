import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { colunaDisponivel } from "@/lib/schema";
import { FormularioCliente } from "../formulario";

export const metadata = { title: "Novo cliente" };

export default async function NovoCliente() {
  const recorrenciaDisponivel = await colunaDisponivel("clientes", "recorrente");

  return (
    <>
      <CabecalhoPagina
        titulo="Novo cliente"
        descricao="O sistema avisa se já existir alguém com o mesmo telefone ou documento."
      />
      <Conteudo>
        <FormularioCliente recorrenciaDisponivel={recorrenciaDisponivel} />
      </Conteudo>
    </>
  );
}
