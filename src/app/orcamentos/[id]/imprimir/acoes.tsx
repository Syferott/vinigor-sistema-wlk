"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, ImageDown, Loader2, Printer } from "lucide-react";

/**
 * PDF e JPG saem da mesma foto da folha. É imagem, não texto selecionável
 * — o preço disso é um arquivo maior e sem busca; o ganho é que o papel
 * enviado é exatamente o que se vê aqui, sem um segundo motor de layout
 * para manter. E o JPG existe por um motivo prático: cliente que abre o
 * zap no celular e não tem leitor de PDF.
 */
async function fotografarFolha(): Promise<HTMLCanvasElement> {
  const folha = document.getElementById("folha");
  if (!folha) throw new Error("Não encontrei a folha do orçamento na tela.");

  const { default: html2canvas } = await import("html2canvas-pro");
  return html2canvas(folha, {
    // o dobro da resolução da tela: menos que isso sai borrado no papel
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });
}

function baixar(url: string, nome: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function AcoesDocumento({ nomeArquivo }: { nomeArquivo: string }) {
  const [ocupado, setOcupado] = useState<"pdf" | "jpg" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function exportar(formato: "pdf" | "jpg") {
    setOcupado(formato);
    setErro(null);

    try {
      const canvas = await fotografarFolha();

      if (formato === "jpg") {
        const url = canvas.toDataURL("image/jpeg", 0.92);
        baixar(url, `${nomeArquivo}.jpg`);
        return;
      }

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
      const largura = pdf.internal.pageSize.getWidth();
      const alturaPagina = pdf.internal.pageSize.getHeight();
      const altura = (canvas.height * largura) / canvas.width;
      const imagem = canvas.toDataURL("image/jpeg", 0.92);

      // Orçamento comprido vira várias páginas: a mesma imagem entra
      // deslocada para cima e o jsPDF corta o que passa da página.
      let deslocamento = 0;
      while (deslocamento < altura) {
        if (deslocamento > 0) pdf.addPage();
        pdf.addImage(imagem, "JPEG", 0, -deslocamento, largura, altura);
        deslocamento += alturaPagina;
      }

      pdf.save(`${nomeArquivo}.pdf`);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não consegui gerar o arquivo.",
      );
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          onClick={() => exportar("pdf")}
          disabled={ocupado !== null}
        >
          {ocupado === "pdf" ? <Loader2 className="animate-spin" /> : <FileDown />}
          Baixar PDF
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => exportar("jpg")}
          disabled={ocupado !== null}
        >
          {ocupado === "jpg" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <ImageDown />
          )}
          Baixar JPG
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => window.print()}
          disabled={ocupado !== null}
        >
          <Printer /> Imprimir
        </Button>
      </div>

      <p className="text-center text-xs text-[#6b7066]">
        JPG para quem abre pelo WhatsApp e não tem leitor de PDF.
      </p>

      {erro && (
        <p className="text-center text-sm text-red-700">{erro}</p>
      )}
    </div>
  );
}
