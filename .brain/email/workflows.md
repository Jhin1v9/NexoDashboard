# Workflows de Email — Nexo Digital

## 1. Novo Lead → Orçamento

```
[Cliente envia email pedindo orçamento]
    ↓
[Luna analisa: intenção = "orçamento", urgência = "alta"]
    ↓
[Luna sugere resposta rápida + rascunho detalhado]
    ↓
[Admin revisa e aprova]
    ↓
[Email enviado com template "Orçamento"]
    ↓
[.brain memory: registra preferências do cliente]
    ↓
[Se não responder em 3 dias → Follow-up automático sugerido]
```

## 2. Suporte Técnico

```
[Cliente relata problema]
    ↓
[Luna analisa: intenção = "suporte", classifica urgência]
    ↓
[Se urgência = "crítica" → Alerta visual no dashboard + WhatsApp]
    ↓
[Luna sugere resposta de confirmação]
    ↓
[Equipe técnica resolve → Luna sugere resposta de resolução]
    ↓
[Cliente confirma resolução → Ticket fechado]
```

## 3. Onboarding de Novo Cliente

```
[Contrato assinado / Pagamento confirmado]
    ↓
[Luna gera email de boas-vindas com template]
    ↓
[Envia dados de acesso, cronograma, contatos]
    ↓
[Agenda reunião de kickoff]
    ↓
[Luna acompanha: follow-up em 7 dias]
```

## 4. Follow-up de Proposta

```
[Proposta enviada há 3 dias]
    ↓
[Luna detecta inatividade]
    ↓
[Sugere follow-up personalizado]
    ↓
[Admin aprova → Email enviado]
    ↓
[Se +4 dias sem resposta → Segundo follow-up (tom mais leve)]
    ↓
[Se +7 dias → Último follow-up + oferta de call rápida]
```

## 5. Detecção de Phishing/Spam

```
[Email recebido]
    ↓
[Luna analisa segurança]
    ↓
[Se isPhishing = true → Alerta vermelho + NÃO sugere resposta]
    ↓
[Se isSpam = true → Sugere mover para spam]
    ↓
[Admin decide ação]
```
