# Regras de Negócio: Plano Office

Este documento detalha o funcionamento sistêmico, fluxo de compra e limitações atreladas ao **Plano Office** da plataforma Bentifiles, com base na implementação atual do Frontend, Backend e Banco de Dados.

## 1. Público-Alvo e Proposta de Valor
O Plano **Office** foi feito sob medida para "escritórios e consultorias em crescimento", com os seguintes atrativos de negócio:
- Documentos ilimitados.
- Verificações avançadas de integridade dos arquivos (OCR e análise de imagem).
- Suporte prioritário 24/7.
- Gestão centralizada de permissões e convites para membros da equipe ou clientes.

## 2. Precificação e Seleção de Quantidade
Diferentemente do plano Individual (que tem valor fixo), o plano Office opera através de **billing por licença/usuário**:
- **Ciclo Mensal:** R$ 49,98 / usuário
- **Ciclo Anual:** R$ 539,76 / usuário (Desconto de aproximadamente 10% no montante anual)
- Ao interagir com o componente de "Pricing" na interface web (`PlanCard`), o usuário pode iteragir com os botões `(+)` e `(-)` para definir a variável **`quantity`** antes de dar início ao checkout.

## 3. Fluxo de Integração via Stripe
1. **Checkout:** Ao confirmar a quantia de vagas/usuários, a requisição passa pelo `billingController.ts`, que cria uma sessão via Stripe acionando as variáveis de ambiente `STRIPE_PRICE_OFFICE` ou `STRIPE_PRICE_OFFICE_YEARLY`.
2. **Registro de Quantidade:** A variável `quantity` é passada ao gateway como detalhe do Line Item (`line_items: [{ price: priceId, quantity }]`). Quem gerencia e controla as renovações e parcelas totais é o próprio provedor externo (Stripe).
3. **Webhook do Sistema:** Quando o pagamento é processado com sucesso, o sistema capta o payload e reflete isso no banco de dados (`User` model) setando os seguintes campos:
   - `subscriptionPlan = 'OFFICE'`
   - `hasSystemAccess = true`
   - `hasSelectedPlan = true`
   - E outras métricas limitadoras que constam nos `metadata` da session do Stripe.
4. **Interface do Assinante:** Quando o dashboard busca o status em `getSubscriptionDetails`, ele se utiliza da API da Stripe consultando ativamente o atributo de `.quantity` na subscrição para apresentar a cobrança real e número de usuários de forma fidedigna.

## 4. Gestão de Membros e Restrições de Convites
De acordo com o nível da conta atual, o fato de ser **Plano Office** garante as seguintes dinâmicas de projetos (em `projectController.ts` e `membershipController.ts`):
- O criador do projeto detém o `Role` de `ADMIN`.
- Ele pode criar Tokens de Convite únicos que expiram em 24h e distribuir para sua equipe na área de Membros do Projeto.
- Os novos membros autenticados utilizam a rota `/api/projects/join` para entrar com esse token, recebendo a atribuição padrão de `USER`.
- Mais tarde, o proprietário (ou outro ADMIN) pode promover `USERS` a `ADMIN` ou expulsá-los. 

> **Aviso de Design (Disclaimer)**:  
> Na concepção imediata do código (`membershipController`), o número máximo de usuários que podem ser inseridos no banco (`ProjectMembership`) ainda não é brutalmente bloqueador em runtime referenciando à variável de `quantity` paga na Stripe. Ou seja, a quantidade contratada define a cobrança que a empresa recebe, entretanto, as checagens rígidas bloqueando a criação do (N+1)-ésimo invite no back-end não estão atuando ativamente bloqueando acessos no MVP do projeto atual. Caso de uso planejado para ser estritamente bloqueador na futura esteira anti-abuso.

## 5. Permissões Globais Adquiridas (`ADMIN` vs `USER` nos Projetos)
Qualquer pessoa dentro de um projeto regido pelas rulesetas de `OFFICE` ganham os seguintes trânsitos:
* **`ADMIN`:** Permite editar dados do projeto, criar links convite, gerenciar cargo dos membros, anexar ou visualizar documentos.
* **`USER`:** Apenas permissões básicas, visualização e submissão/upload de documentos de cliente.

### Resumo do Status Atual
A regra de negócio propõe que seja um *hub* multi-empresarial, oferecendo recursos ilimitados vinculando a monetização *per-seat* no check-out, liberando para os inquilinos a utilização fluida da plataforma com ferramentas avançadas e integridade de arquivo automatizada via rotina de verificação em nuvem.
