# 🔧 Como Habilitar Realtime - Guia Passo a Passo com Imagens

## ✅ Passo 1: Acesse o Dashboard do Supabase

**Clique neste link:**
👉 https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/database/publications

Se você não estiver logado, faça login primeiro.

---

## ✅ Passo 2: Encontre a Publicação "supabase_realtime"

Você verá uma tela assim:

```
┌─────────────────────────────────────────────────────────────┐
│ Database > Publications                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Publications                                                 │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ Name: supabase_realtime                              │   │
│ │ Owner: postgres                                      │   │
│ │ Tables: [Lista de tabelas]                           │   │
│ │                                    [Edit] [Delete]   │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Ação:** Clique no botão **[Edit]** ao lado de "supabase_realtime"

---

## ✅ Passo 3: Adicione a Tabela "lots"

Após clicar em Edit, você verá:

```
┌─────────────────────────────────────────────────────────────┐
│ Edit Publication: supabase_realtime                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Tables in this publication:                                 │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ [✓] some_table                                       │   │
│ │ [✓] another_table                                    │   │
│ │ [ ] lots                          👈 ENCONTRE ESTA!  │   │
│ │ [ ] other_table                                      │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                              │
│                               [Cancel]  [Save]               │
└─────────────────────────────────────────────────────────────┘
```

**Ação:** 
1. Encontre a linha com **"lots"**
2. **Marque o checkbox** ao lado de "lots" ✅
3. Clique no botão **[Save]**

---

## ✅ Passo 4: Verifique se Funcionou

Depois de salvar:

1. **Recarregue a aplicação** no navegador (F5 ou Ctrl+R)
2. **Abra o Console do navegador** (F12)
3. **Procure pela mensagem:**
   - ✅ **SE VER:** `✅ Real-time subscription active` → **SUCESSO!** 🎉
   - ❌ **SE VER:** `Real-time subscription failed` → Algo deu errado, tente novamente

---

## 🚨 Alternativa: Via SQL (Se não encontrar a opção visual)

Se você não conseguir encontrar as opções acima, pode executar SQL diretamente:

1. **Acesse:** https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/sql/new

2. **Cole este SQL:**
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE public.lots;
   ```

3. **Clique em "Run"** ou pressione Ctrl+Enter

4. **Verifique:** Você deve ver "Success" ou "No rows returned"

---

## 📊 Status Atual

🔴 **Realtime:** DESABILITADO (aplicação funcionando em modo offline)  
🟢 **Aplicação:** FUNCIONANDO normalmente  
⏳ **Aguardando:** Configuração manual do Realtime  

## ✨ Após Habilitar Realtime

Com Realtime habilitado, você terá:

- ✅ **Sincronização automática** entre diferentes abas/usuários
- ✅ **Updates em tempo real** quando alguém editar um lote
- ✅ **Notificações instantâneas** de novos lotes criados
- ✅ **Deletions refletidas imediatamente** em todos os clientes

Sem Realtime, a aplicação ainda funciona, mas:
- ⚠️ Mudanças só aparecem após **reload da página**
- ⚠️ Não há sincronização entre usuários
- ⚠️ Cache localStorage é usado como fallback

---

## 🆘 Precisa de Ajuda?

Se você encontrar dificuldades:

1. Tire um **screenshot** da tela do Supabase
2. Me mostre o que está vendo
3. Posso te guiar exatamente onde clicar

**Link direto para Publications:**
https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/database/publications

**Link direto para SQL Editor:**
https://supabase.com/dashboard/project/tvsbgbroyauxyliybsvo/sql/new
