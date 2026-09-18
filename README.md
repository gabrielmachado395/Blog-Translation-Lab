# Blog Translation Lab

Projeto pessoal criado para estudar, na prática, como funciona a integração de serviços de tradução automática em uma aplicação web.

A ideia foi construir um pequeno blog local com CRUD, onde artigos podem ser criados, editados, excluídos e traduzidos automaticamente usando Azure Translator.

## Objetivo

Entender melhor como implementar tradução automática em cenários reais, principalmente:

- tradução de conteúdo criado via CRUD;
- tradução de conteúdo estático em Markdown;
- chamada segura de APIs externas pelo backend;
- armazenamento local de traduções;
- separação entre frontend, backend e provider de tradução.

## Como Funciona

O fluxo principal é:
Frontend
-> envia o artigo para o backend

Backend
-> salva o artigo original
-> chama a API do Azure Translator

Azure Translator
-> traduz o conteúdo

Backend
-> armazena o texto traduzido

Frontend
-> exibe a versão traduzida conforme o idioma selecionado
