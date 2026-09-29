# DG Delivery — field test

## Demo URL
https://ruggeropaolobasile.github.io/mio-sito/reorder-dg/

## Obiettivo
Validare in 5-10 minuti se il flusso **catalogo -> ordine -> WhatsApp -> riordino** riduce attrito rispetto alla presa ordine attuale.

## Script operativo
1. Aprire la demo dal telefono.
2. Aggiungere 2-3 prodotti reali.
3. Inserire nome e indirizzo di prova.
4. Mostrare il messaggio WhatsApp generato, senza inviarlo.
5. Riaprire la demo e premere **Riordina l'ultimo**.
6. Chiedere al commerciante solo dati operativi, non feedback generici.

## Domande di validazione
- Come arrivano oggi gli ordini: telefono, WhatsApp, Facebook, altro?
- Quanti ordini a domicilio gestite in una giornata normale?
- Quanti clienti riordinano sempre gli stessi prodotti?
- Il listino online attuale viene aggiornato manualmente?
- Vi serve distinguere privati e clienti ingrosso?
- Chi prepara l'ordine e chi organizza le consegne?
- Qual e il problema piu frequente: indirizzi, disponibilita, prezzi, telefonate, tempi o giro consegne?
- Usereste un sistema del genere se non cambiasse il vostro modo di lavorare?

## Segnale GO
Procedere alla V1 solo se emergono almeno due tra:
- ordini ricorrenti;
- volume significativo via telefono/WhatsApp;
- errori o tempo perso nella presa ordine;
- bisogno di storico cliente;
- interesse esplicito per riordino rapido;
- interesse B2B/ingrosso.

## Segnale STOP
Non costruire backend se il merchant non percepisce valore nel flusso di riordino o se il volume e troppo basso.

## Esperimento prezzo
Non proporre subito un contratto. Dopo la demo, testare disponibilita verso:
- setup una tantum;
- canone mensile;
- alternativa: prova pilota breve.

I prezzi restano ipotesi da validare.

## Nota
POC non ufficiale. Prezzi e disponibilita del catalogo derivano dal listino pubblico e devono essere confermati da DG Delivery prima di qualsiasi uso reale.
