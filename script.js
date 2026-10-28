"use strict";

// ============================================================
// 1. CONFIGURAÇÕES
// ============================================================

const CHAVE_ARMAZENAMENTO = "arquivoDeNoticias";
const ASSUNTOS = ["Política", "História", "Economia", "Sociedade", "Internacional"];
const NOTICIAS_POR_PAGINA = 9;
const TAMANHO_MAXIMO_IMPORTACAO = 2 * 1024 * 1024; // 2 MB
const LIMITES = { titulo: 150, resumo: 600, fonte: 120, link: 500 };

// ============================================================
// 2. DADOS INICIAIS
// ============================================================

const noticiasIniciais = [
    {
        id: "exemplo-abolicao",
        titulo: "Abolição da escravidão no Brasil",
        assunto: "História",
        data: "1888-05-13",
        resumo: "A Lei Áurea declarou extinta legalmente a escravidão no Brasil.",
        fonte: "Exemplo histórico",
        link: ""
    },
    {
        id: "exemplo-republica",
        titulo: "Proclamação da República",
        assunto: "História",
        data: "1889-11-15",
        resumo: "O Brasil deixou de ser uma monarquia e tornou-se uma república.",
        fonte: "Exemplo histórico",
        link: ""
    },
    {
        id: "exemplo-diretas",
        titulo: "Movimento Diretas Já",
        assunto: "Política",
        data: "1984-04-25",
        resumo: "Uma grande mobilização popular defendeu eleições diretas para presidente.",
        fonte: "Exemplo histórico",
        link: ""
    },
    {
        id: "exemplo-constituicao",
        titulo: "Promulgação da Constituição de 1988",
        assunto: "Política",
        data: "1988-10-05",
        resumo: "A Constituição estabeleceu novas bases para a organização democrática do Brasil.",
        fonte: "Exemplo histórico",
        link: ""
    },
    {
        id: "exemplo-muro",
        titulo: "Queda do Muro de Berlim",
        assunto: "Internacional",
        data: "1989-11-09",
        resumo: "A abertura do muro tornou-se um marco da reunificação alemã.",
        fonte: "Exemplo histórico",
        link: ""
    },
    {
        id: "exemplo-real",
        titulo: "Implantação do Plano Real",
        assunto: "Economia",
        data: "1994-07-01",
        resumo: "A nova moeda entrou em circulação e marcou uma transformação econômica no Brasil.",
        fonte: "Exemplo histórico",
        link: ""
    }
];

// ============================================================
// 3. FUNÇÕES AUXILIARES
// ============================================================

function gerarId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return "n-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

// Converte "1888-05-13" em "13/05/1888" sem usar new Date(),
// evitando o erro de um dia a menos por causa do fuso horário
function formatarData(dataTexto) {
    const [ano, mes, dia] = String(dataTexto).split("-");

    if (!ano || !mes || !dia) {
        return dataTexto;
    }

    return `${dia}/${mes}/${ano}`;
}

// Data de hoje no formato AAAA-MM-DD, no horário local
function dataDeHoje() {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");

    return `${hoje.getFullYear()}-${mes}-${dia}`;
}

// Verifica se o texto é uma data real no formato AAAA-MM-DD
function dataValida(texto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        return false;
    }

    const [ano, mes, dia] = texto.split("-").map(Number);
    const data = new Date(Date.UTC(ano, mes - 1, dia));

    return (
        data.getUTCFullYear() === ano &&
        data.getUTCMonth() === mes - 1 &&
        data.getUTCDate() === dia
    );
}

// Remove acentos e deixa em minúsculas ("Política" e "politica" ficam iguais)
function normalizarTexto(texto) {
    return String(texto)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

// Só aceita links http/https (evita links perigosos como "javascript:")
function linkSeguro(link) {
    try {
        const url = new URL(link);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch (erro) {
        return false;
    }
}

function limparTexto(valor, maximo) {
    if (typeof valor !== "string") {
        return "";
    }

    return valor.trim().slice(0, maximo);
}

// Duas notícias são consideradas iguais se têm o mesmo título e a mesma data
function mesmaNoticia(a, b) {
    return normalizarTexto(a.titulo) === normalizarTexto(b.titulo) && a.data === b.data;
}

// Valida e padroniza uma notícia. Devolve null se estiver inválida.
function normalizarNoticia(bruta) {
    if (!bruta || typeof bruta !== "object") {
        return null;
    }

    const titulo = limparTexto(bruta.titulo, LIMITES.titulo);
    const assunto = limparTexto(bruta.assunto, 40);
    const data = limparTexto(bruta.data, 10);
    const resumo = limparTexto(bruta.resumo, LIMITES.resumo);
    const fonte = limparTexto(bruta.fonte, LIMITES.fonte);
    let link = limparTexto(bruta.link, LIMITES.link);

    if (!titulo || !resumo || !fonte) {
        return null;
    }

    if (!ASSUNTOS.includes(assunto) || !dataValida(data)) {
        return null;
    }

    if (link && !linkSeguro(link)) {
        link = "";
    }

    const id = limparTexto(bruta.id, 60) || gerarId();

    return { id, titulo, assunto, data, resumo, fonte, link };
}

function normalizarLista(lista) {
    const idsUsados = new Set();
    const resultado = [];

    lista.forEach(function (item) {
        const noticia = normalizarNoticia(item);

        if (!noticia) {
            return;
        }

        if (idsUsados.has(noticia.id)) {
            noticia.id = gerarId();
        }

        idsUsados.add(noticia.id);
        resultado.push(noticia);
    });

    return resultado;
}

function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);

    if (classe) {
        elemento.className = classe;
    }

    if (texto !== undefined) {
        elemento.textContent = texto;
    }

    return elemento;
}

// ============================================================
// 4. ARMAZENAMENTO
// ============================================================

// Carrega as notícias salvas no navegador.
// Se não houver nada salvo, usa uma cópia das notícias iniciais.
function carregarNoticias() {
    try {
        const noticiasSalvas = localStorage.getItem(CHAVE_ARMAZENAMENTO);

        if (noticiasSalvas !== null) {
            const listaSalva = JSON.parse(noticiasSalvas);

            // Aceita também lista vazia, para que notícias apagadas não voltem sozinhas
            if (Array.isArray(listaSalva)) {
                return normalizarLista(listaSalva);
            }
        }
    } catch (erro) {
        console.error("Erro ao carregar notícias:", erro);
    }

    return normalizarLista(noticiasIniciais);
}

let noticias = carregarNoticias();

// Salva a lista atual no navegador
function salvarNoticias() {
    try {
        localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(noticias));
        return true;
    } catch (erro) {
        console.error("Não foi possível salvar as notícias:", erro);
        return false;
    }
}

// Salva e avisa o usuário se o navegador bloquear o salvamento
function salvarComAviso() {
    const salvou = salvarNoticias();

    if (!salvou) {
        mostrarAviso(
            "Não foi possível salvar no navegador. Exporte um backup para não perder os dados.",
            "erro"
        );
    }

    return salvou;
}

// Adiciona à lista as notícias novas (ignora as que já existem). Devolve quantas entraram.
function mesclarNoticias(lista) {
    let adicionadas = 0;

    lista.forEach(function (nova) {
        const jaExiste = noticias.some(function (existente) {
            return mesmaNoticia(existente, nova);
        });

        if (jaExiste) {
            return;
        }

        const idRepetido = noticias.some(function (existente) {
            return existente.id === nova.id;
        });

        if (idRepetido) {
            nova.id = gerarId();
        }

        noticias.push(nova);
        adicionadas++;
    });

    return adicionadas;
}

// ============================================================
// 5. ELEMENTOS DA PÁGINA
// ============================================================

const formPesquisa = document.getElementById("form-pesquisa");
const campoPalavra = document.getElementById("palavra");
const campoAssunto = document.getElementById("assunto");
const campoOrdenacao = document.getElementById("ordenacao");
const campoDataInicial = document.getElementById("data-inicial");
const campoDataFinal = document.getElementById("data-final");

const textoQuantidade = document.getElementById("quantidade");
const listaNoticias = document.getElementById("lista-noticias");
const botaoMostrarMais = document.getElementById("mostrar-mais");

const secaoCadastro = document.getElementById("cadastro");
const secaoResultados = document.getElementById("resultados");
const tituloCadastro = document.getElementById("titulo-cadastro");
const formCadastro = document.getElementById("form-cadastro");
const campoNovoTitulo = document.getElementById("novo-titulo");
const campoNovoAssunto = document.getElementById("novo-assunto");
const campoNovaData = document.getElementById("novo-data");
const campoNovoResumo = document.getElementById("novo-resumo");
const campoNovaFonte = document.getElementById("nova-fonte");
const campoNovoLink = document.getElementById("novo-link");
const contadorResumo = document.getElementById("contador-resumo");
const botaoSalvar = document.getElementById("botao-salvar");
const botaoCancelar = document.getElementById("botao-cancelar");
const mensagemCadastro = document.getElementById("mensagem-cadastro");

const botaoExportar = document.getElementById("botao-exportar");
const botaoImportar = document.getElementById("botao-importar");
const botaoRestaurar = document.getElementById("botao-restaurar");
const campoArquivo = document.getElementById("arquivo-importacao");

const estatTotal = document.getElementById("estat-total");
const estatAssuntos = document.getElementById("estat-assuntos");
const estatPeriodo = document.getElementById("estat-periodo");

const dialogo = document.getElementById("dialogo");
const dialogoTitulo = document.getElementById("dialogo-titulo");
const dialogoTexto = document.getElementById("dialogo-texto");
const dialogoConfirmar = document.getElementById("dialogo-confirmar");

const toast = document.getElementById("toast");
const botaoVoltarTopo = document.getElementById("voltar-topo");

// Estado da página
let quantidadeVisivel = NOTICIAS_POR_PAGINA;
let idEmEdicao = null;

// ============================================================
// 6. AVISOS E CONFIRMAÇÃO
// ============================================================

let temporizadorAviso;

function mostrarAviso(texto, tipo) {
    toast.textContent = texto;
    toast.className = "toast visivel" + (tipo === "erro" ? " erro" : "");

    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () {
        toast.classList.remove("visivel");
    }, 4500);
}

function mostrarMensagemCadastro(texto, tipo) {
    mensagemCadastro.textContent = texto;
    mensagemCadastro.className = "mensagem-formulario" + (tipo ? " " + tipo : "");
}

// Abre a janela de confirmação e devolve uma Promise (true = confirmou)
function confirmar(titulo, texto, textoBotao) {
    return new Promise(function (resolver) {
        if (typeof dialogo.showModal !== "function") {
            resolver(window.confirm(texto));
            return;
        }

        dialogoTitulo.textContent = titulo;
        dialogoTexto.textContent = texto;
        dialogoConfirmar.textContent = textoBotao;
        dialogo.returnValue = "";

        dialogo.addEventListener(
            "close",
            function () {
                resolver(dialogo.returnValue === "confirmar");
            },
            { once: true }
        );

        dialogo.showModal();
    });
}

// ============================================================
// 7. PESQUISA, ORDENAÇÃO E EXIBIÇÃO
// ============================================================

function filtrarNoticias() {
    const palavra = normalizarTexto(campoPalavra.value);
    const assunto = campoAssunto.value;
    const dataInicial = campoDataInicial.value;
    const dataFinal = campoDataFinal.value;

    return noticias.filter(function (noticia) {
        if (assunto && noticia.assunto !== assunto) {
            return false;
        }

        // Datas no formato AAAA-MM-DD podem ser comparadas como texto
        if (dataInicial && noticia.data < dataInicial) {
            return false;
        }

        if (dataFinal && noticia.data > dataFinal) {
            return false;
        }

        if (palavra) {
            const textoDaNoticia = normalizarTexto(
                [noticia.titulo, noticia.assunto, noticia.resumo, noticia.fonte].join(" ")
            );

            if (!textoDaNoticia.includes(palavra)) {
                return false;
            }
        }

        return true;
    });
}

function ordenarNoticias(lista) {
    const criterio = campoOrdenacao.value;
    const copia = [...lista];

    function porTitulo(a, b) {
        return a.titulo.localeCompare(b.titulo, "pt-BR");
    }

    if (criterio === "antigas") {
        copia.sort(function (a, b) {
            return a.data.localeCompare(b.data) || porTitulo(a, b);
        });
    } else if (criterio === "titulo") {
        copia.sort(porTitulo);
    } else {
        copia.sort(function (a, b) {
            return b.data.localeCompare(a.data) || porTitulo(a, b);
        });
    }

    return copia;
}

function criarCartao(noticia) {
    const cartao = criarElemento("article", "noticia");

    const categoria = criarElemento("span", "categoria", noticia.assunto);

    const data = criarElemento("time", "data", formatarData(noticia.data));
    data.dateTime = noticia.data;

    const titulo = criarElemento("h3", "", noticia.titulo);
    const resumo = criarElemento("p", "", noticia.resumo);
    const fonte = criarElemento("p", "fonte", "Fonte: " + noticia.fonte);

    cartao.append(categoria, data, titulo, resumo, fonte);

    if (noticia.link && linkSeguro(noticia.link)) {
        const link = criarElemento("a", "", "Ler notícia completa");
        link.href = noticia.link;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        cartao.append(link);
    }

    const acoes = criarElemento("div", "acoes");

    const botaoEditar = criarElemento("button", "secundario pequeno", "Editar");
    botaoEditar.type = "button";
    botaoEditar.addEventListener("click", function () {
        iniciarEdicao(noticia);
    });

    const botaoExcluir = criarElemento("button", "perigo pequeno", "Excluir");
    botaoExcluir.type = "button";
    botaoExcluir.addEventListener("click", function () {
        excluirNoticia(noticia);
    });

    acoes.append(botaoEditar, botaoExcluir);
    cartao.append(acoes);

    return cartao;
}

function atualizarEstatisticas() {
    estatTotal.textContent = noticias.length;
    estatAssuntos.textContent = new Set(
        noticias.map(function (noticia) {
            return noticia.assunto;
        })
    ).size;

    if (noticias.length === 0) {
        estatPeriodo.textContent = "—";
        return;
    }

    const anos = noticias
        .map(function (noticia) {
            return noticia.data.slice(0, 4);
        })
        .sort();

    const primeiro = anos[0];
    const ultimo = anos[anos.length - 1];

    estatPeriodo.textContent = primeiro === ultimo ? primeiro : `${primeiro}–${ultimo}`;
}

function exibirNoticias() {
    atualizarEstatisticas();

    listaNoticias.replaceChildren();
    botaoMostrarMais.hidden = true;

    const dataInicial = campoDataInicial.value;
    const dataFinal = campoDataFinal.value;

    if (dataInicial && dataFinal && dataInicial > dataFinal) {
        textoQuantidade.textContent = "A data inicial não pode ser maior que a data final.";
        return;
    }

    if (noticias.length === 0) {
        textoQuantidade.textContent =
            "O arquivo está vazio. Cadastre uma notícia ou restaure os exemplos.";
        return;
    }

    const encontradas = ordenarNoticias(filtrarNoticias());

    if (encontradas.length === 0) {
        textoQuantidade.textContent = "Nenhuma notícia encontrada com esses filtros.";
        return;
    }

    const visiveis = encontradas.slice(0, quantidadeVisivel);

    if (encontradas.length === 1) {
        textoQuantidade.textContent = "1 notícia encontrada.";
    } else if (visiveis.length === encontradas.length) {
        textoQuantidade.textContent = `${encontradas.length} notícias encontradas.`;
    } else {
        textoQuantidade.textContent =
            `Mostrando ${visiveis.length} de ${encontradas.length} notícias.`;
    }

    const fragmento = document.createDocumentFragment();

    visiveis.forEach(function (noticia) {
        fragmento.append(criarCartao(noticia));
    });

    listaNoticias.append(fragmento);

    const restantes = encontradas.length - visiveis.length;

    if (restantes > 0) {
        botaoMostrarMais.textContent = `Mostrar mais notícias (${restantes})`;
        botaoMostrarMais.hidden = false;
    }
}

function aoMudarFiltro() {
    quantidadeVisivel = NOTICIAS_POR_PAGINA;
    exibirNoticias();
}

function limparFiltros() {
    formPesquisa.reset();
    quantidadeVisivel = NOTICIAS_POR_PAGINA;
}

// ============================================================
// 8. CADASTRO, EDIÇÃO E EXCLUSÃO
// ============================================================

function atualizarContador() {
    contadorResumo.textContent = `${campoNovoResumo.value.length}/${LIMITES.resumo}`;
}

function iniciarEdicao(noticia) {
    idEmEdicao = noticia.id;

    campoNovoTitulo.value = noticia.titulo;
    campoNovoAssunto.value = noticia.assunto;
    campoNovaData.value = noticia.data;
    campoNovoResumo.value = noticia.resumo;
    campoNovaFonte.value = noticia.fonte;
    campoNovoLink.value = noticia.link;
    atualizarContador();

    tituloCadastro.textContent = "Editar notícia";
    botaoSalvar.textContent = "Salvar alterações";
    botaoCancelar.hidden = false;
    mostrarMensagemCadastro("", "");

    secaoCadastro.scrollIntoView();
    campoNovoTitulo.focus({ preventScroll: true });
}

function cancelarEdicao() {
    idEmEdicao = null;

    formCadastro.reset();
    atualizarContador();

    tituloCadastro.textContent = "Cadastrar nova notícia";
    botaoSalvar.textContent = "Cadastrar notícia";
    botaoCancelar.hidden = true;
    mostrarMensagemCadastro("", "");
}

async function excluirNoticia(noticia) {
    const confirmou = await confirmar(
        "Excluir notícia",
        `Deseja excluir "${noticia.titulo}"? Esta ação não pode ser desfeita.`,
        "Excluir"
    );

    if (!confirmou) {
        return;
    }

    noticias = noticias.filter(function (item) {
        return item.id !== noticia.id;
    });

    if (idEmEdicao === noticia.id) {
        cancelarEdicao();
    }

    salvarComAviso();
    exibirNoticias();
    mostrarAviso("Notícia excluída.");
}

function tratarCadastro(evento) {
    evento.preventDefault();

    const dados = {
        titulo: campoNovoTitulo.value.trim(),
        assunto: campoNovoAssunto.value,
        data: campoNovaData.value,
        resumo: campoNovoResumo.value.trim(),
        fonte: campoNovaFonte.value.trim(),
        link: campoNovoLink.value.trim()
    };

    if (!dados.titulo || !dados.resumo || !dados.fonte) {
        mostrarMensagemCadastro("Preencha todos os campos obrigatórios.", "erro");
        return;
    }

    if (!dataValida(dados.data)) {
        mostrarMensagemCadastro("Informe uma data válida.", "erro");
        return;
    }

    if (dados.link && !linkSeguro(dados.link)) {
        mostrarMensagemCadastro("O link precisa começar com http:// ou https://.", "erro");
        return;
    }

    const duplicada = noticias.some(function (existente) {
        return existente.id !== idEmEdicao && mesmaNoticia(existente, dados);
    });

    if (duplicada) {
        mostrarMensagemCadastro("Já existe uma notícia com esse título e essa data.", "erro");
        return;
    }

    const estavaEditando = idEmEdicao !== null;

    if (estavaEditando) {
        const alvo = noticias.find(function (item) {
            return item.id === idEmEdicao;
        });

        if (alvo) {
            Object.assign(alvo, dados);
        }
    } else {
        noticias.push(Object.assign({ id: gerarId() }, dados));
    }

    const salvou = salvarNoticias();

    cancelarEdicao();
    limparFiltros();
    exibirNoticias();

    if (!salvou) {
        mostrarAviso(
            "Notícia registrada, mas não foi possível salvar no navegador. Exporte um backup.",
            "erro"
        );
    } else {
        mostrarAviso(estavaEditando ? "Notícia atualizada!" : "Notícia cadastrada com sucesso!");
    }

    if (estavaEditando) {
        secaoResultados.scrollIntoView();
    }
}

// ============================================================
// 9. BACKUP: EXPORTAR, IMPORTAR E RESTAURAR
// ============================================================

function exportarNoticias() {
    if (noticias.length === 0) {
        mostrarAviso("Não há notícias para exportar.", "erro");
        return;
    }

    const conteudo = JSON.stringify(
        { versao: 1, exportadoEm: new Date().toISOString(), noticias: noticias },
        null,
        2
    );

    const arquivo = new Blob([conteudo], { type: "application/json" });
    const url = URL.createObjectURL(arquivo);

    const link = document.createElement("a");
    link.href = url;
    link.download = `arquivo-de-noticias-${dataDeHoje()}.json`;

    document.body.append(link);
    link.click();
    link.remove();

    setTimeout(function () {
        URL.revokeObjectURL(url);
    }, 1000);

    mostrarAviso(
        noticias.length === 1 ? "1 notícia exportada." : `${noticias.length} notícias exportadas.`
    );
}

async function importarArquivo() {
    const arquivo = campoArquivo.files[0];

    if (!arquivo) {
        return;
    }

    try {
        if (arquivo.size > TAMANHO_MAXIMO_IMPORTACAO) {
            throw new Error("arquivo-grande");
        }

        const texto = await arquivo.text();
        const dados = JSON.parse(texto);

        let lista = null;

        if (Array.isArray(dados)) {
            lista = dados;
        } else if (dados && Array.isArray(dados.noticias)) {
            lista = dados.noticias;
        }

        if (!lista) {
            throw new Error("formato-invalido");
        }

        const validas = normalizarLista(lista);
        const adicionadas = mesclarNoticias(validas);
        const ignoradas = lista.length - adicionadas;

        if (adicionadas > 0) {
            salvarComAviso();
            limparFiltros();
            exibirNoticias();
        }

        if (adicionadas === 0) {
            mostrarAviso("Nenhuma notícia nova foi importada (duplicadas ou inválidas).", "erro");
        } else {
            let mensagem = adicionadas === 1
                ? "1 notícia importada."
                : `${adicionadas} notícias importadas.`;

            if (ignoradas > 0) {
                mensagem += ` ${ignoradas} ignorada(s) por serem duplicadas ou inválidas.`;
            }

            mostrarAviso(mensagem);
        }
    } catch (erro) {
        console.error("Erro ao importar:", erro);

        if (erro.message === "arquivo-grande") {
            mostrarAviso("O arquivo é grande demais (máximo de 2 MB).", "erro");
        } else {
            mostrarAviso("Arquivo inválido. Escolha um arquivo .json exportado por este site.", "erro");
        }
    } finally {
        campoArquivo.value = "";
    }
}

function restaurarExemplos() {
    const adicionadas = mesclarNoticias(normalizarLista(noticiasIniciais));

    if (adicionadas === 0) {
        mostrarAviso("Todas as notícias de exemplo já estão no arquivo.");
        return;
    }

    salvarComAviso();
    limparFiltros();
    exibirNoticias();
    mostrarAviso(
        adicionadas === 1
            ? "1 notícia de exemplo restaurada."
            : `${adicionadas} notícias de exemplo restauradas.`
    );
}

// ============================================================
// 10. EVENTOS
// ============================================================

// Pesquisa
formPesquisa.addEventListener("submit", function (evento) {
    evento.preventDefault();
    aoMudarFiltro();
});

// Limpar filtros (o reset limpa os campos; depois atualizamos a lista)
formPesquisa.addEventListener("reset", function () {
    quantidadeVisivel = NOTICIAS_POR_PAGINA;
    setTimeout(exibirNoticias, 0);
});

// Pesquisa ao digitar (com pequena espera para não travar)
let temporizadorBusca;

campoPalavra.addEventListener("input", function () {
    clearTimeout(temporizadorBusca);
    temporizadorBusca = setTimeout(aoMudarFiltro, 250);
});

campoPalavra.addEventListener("search", aoMudarFiltro);

[campoAssunto, campoOrdenacao, campoDataInicial, campoDataFinal].forEach(function (campo) {
    campo.addEventListener("change", aoMudarFiltro);
});

botaoMostrarMais.addEventListener("click", function () {
    quantidadeVisivel += NOTICIAS_POR_PAGINA;
    exibirNoticias();
});

// Cadastro e edição
formCadastro.addEventListener("submit", tratarCadastro);
botaoCancelar.addEventListener("click", cancelarEdicao);
campoNovoResumo.addEventListener("input", atualizarContador);

// Backup
botaoExportar.addEventListener("click", exportarNoticias);
botaoImportar.addEventListener("click", function () {
    campoArquivo.click();
});
campoArquivo.addEventListener("change", importarArquivo);
botaoRestaurar.addEventListener("click", restaurarExemplos);

// Voltar ao topo
window.addEventListener(
    "scroll",
    function () {
        botaoVoltarTopo.hidden = window.scrollY < 400;
    },
    { passive: true }
);

botaoVoltarTopo.addEventListener("click", function () {
    window.scrollTo(0, 0);
});

// ============================================================
// 11. INÍCIO
// ============================================================

// Não permite cadastrar notícias com data no futuro
campoNovaData.max = dataDeHoje();

document.getElementById("ano").textContent = new Date().getFullYear();

atualizarContador();
exibirNoticias();
