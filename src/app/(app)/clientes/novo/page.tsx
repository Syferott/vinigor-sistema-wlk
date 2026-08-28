import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { FormularioCliente } from "../formulario";

export const metadata = { title: "Novo cliente" };

export default function NovoCliente() {
  return (
    <>
      <CabecalhoPagina
        titulo="Novo cliente"
        descricao="O sistema avisa se já existir alguém com o mesmo telefone ou documento."
      />
      <Conteudo>
        <FormularioCliente />
      </Conteudo>
    </>
  );
}
