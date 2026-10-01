export type TourId = 'dashboard' | 'project';

export interface TourStep {
    /** Valor do atributo data-tour do elemento destacado. Sem target, o passo é um cartão central. */
    target?: string;
    /**
     * Passos com alvo oculto são pulados (ex.: a barra de processamento só existe durante uma validação).
     * Com esta marca, o passo aparece como cartão sem destaque: usado para o menu, que no celular fica
     * dentro do botão ☰ e esconderia justamente os passos mais importantes.
     */
    showWithoutTarget?: boolean;
    title: string;
    body: string;
}

// Passos cujo alvo não existe na tela são pulados, salvo os marcados com showWithoutTarget.
// Por isso o mesmo roteiro serve para quem convida e para quem só envia documentos.
export const TOURS: Record<TourId, TourStep[]> = {
    dashboard: [
        {
            title: 'Bem-vindo ao Bentifiles',
            body: 'Aqui você coleta documentos de clientes ou colaboradores e o sistema confere, na hora, se cada arquivo está legível. Este guia mostra o caminho em poucos passos.',
        },
        {
            target: 'new-project',
            showWithoutTarget: true,
            title: 'Comece criando um projeto',
            body: 'Um projeto é o espaço de uma coleta: um cliente, um processo ou um setor. Cada projeto tem seus próprios participantes e documentos pedidos. O botão “Novo Projeto” fica no menu, e criar projetos exige uma assinatura ativa.',
        },
        {
            target: 'projects',
            title: 'Seus projetos ficam aqui',
            body: 'Os projetos que você criar aparecem nesta área. Abra um para convidar pessoas, definir os documentos pedidos e acompanhar os envios.',
        },
        {
            target: 'tabs',
            title: 'Duas visões, dois papéis',
            body: '“Meus documentos” mostra o que você enviou e o resultado da validação. “Documentos para avaliar” lista o que outras pessoas enviaram aos seus projetos e aguarda a sua decisão.',
        },
        {
            target: 'stats',
            title: 'Como ler os números',
            body: 'Aprovado passou na validação ou foi aceito por um revisor. Revisão pede uma olhada humana. Rejeitado estava ilegível ou foi recusado, e o motivo aparece no cartão do arquivo.',
        },
        {
            target: 'files',
            title: 'Cada arquivo, com seu status',
            body: 'Aqui está o histórico recente de envios, cada um com status e projeto de origem. Se um arquivo foi rejeitado, abra o projeto para reenviar.',
        },
        {
            target: 'processing',
            title: 'Validação em andamento',
            body: 'Arquivos recém-enviados passam por uma conferência automática. Esta barra mostra quantos ainda estão na fila.',
        },
        {
            target: 'templates',
            showWithoutTarget: true,
            title: 'Defina o que pedir',
            body: 'Em Tipos & Templates você cadastra os tipos de documento que podem ser pedidos, como RG ou contrato. Depois, em cada projeto, escolhe quais deles são obrigatórios.',
        },
        {
            target: 'profile',
            showWithoutTarget: true,
            title: 'Conta e assinatura',
            body: 'Perfil, assinatura e programa de afiliados ficam no menu da conta: o avatar no computador, ou o botão ☰ no celular. Para rever este guia, use a lâmpada a qualquer momento.',
        },
    ],
    project: [
        {
            title: 'A página do projeto',
            body: 'Aqui você acompanha, pessoa por pessoa, quais documentos já chegaram e quais ainda faltam.',
        },
        {
            target: 'invite',
            title: 'Convide quem vai enviar',
            body: 'Gere um link de convite ou envie por e-mail. Quem aceita entra no projeto, e você acompanha o status de cada convite na mesma janela.',
        },
        {
            target: 'settings',
            title: 'Escolha os documentos pedidos',
            body: 'Em Configurações do projeto você define a lista de documentos obrigatórios. Sem ela, o checklist abaixo fica vazio.',
        },
        {
            target: 'metrics',
            title: 'Visão geral',
            body: 'Contribuidores, documentos enviados, revisões pendentes e o progresso geral do projeto, num só lugar.',
        },
        {
            target: 'checklist',
            title: 'Checklist por pessoa',
            body: 'Cada pessoa tem um cartão com seu progresso. Abra “Detalhes” para ver cada documento pedido e o status dele.',
        },
        {
            target: 'doc-row',
            title: 'Ações em cada documento',
            body: 'Quem envia usa Upload, ou Re-enviar quando o arquivo foi rejeitado. O sistema confere a legibilidade: arquivo desfocado ou cortado é recusado na hora, com o motivo. Quem avalia usa Aprovar ou Rejeitar, e a rejeição leva um motivo que a pessoa vê.',
        },
    ],
};
