insert into employees (id, name, email, role, active) values
  ('00000000-0000-0000-0000-000000000101', 'Salma Benali', 'salma@example.com', 'recovery', true),
  ('00000000-0000-0000-0000-000000000102', 'Youssef Amrani', 'youssef@example.com', 'recovery', true)
on conflict (email) do nothing;

insert into orders (
  sendit_order_id, order_reference, customer_name, phone, city, address,
  product_name, amount, current_status, previous_status, status_category,
  is_problematic, is_recovered, assigned_employee_id, followup_attempts, last_status_update
) values
  ('SND-24091', 'COD-24091', 'Hind Ait', '212661234567', 'Casablanca', 'Maarif, Residence Atlas', 'Pack skincare', 349, 'Injoignable', 'En livraison', 'problematic', true, false, '00000000-0000-0000-0000-000000000101', 2, now()),
  ('SND-24088', 'COD-24088', 'Karim Tazi', '212677888991', 'Rabat', 'Hay Riad, Avenue Annakhil', 'Montre connectee', 499, 'Adresse incorrecte', 'En livraison', 'problematic', true, false, '00000000-0000-0000-0000-000000000101', 1, now()),
  ('SND-24073', 'COD-24073', 'Imane Berrada', '212690112244', 'Marrakech', 'Gueliz, pres Carre Eden', 'Set cuisine', 279, 'Reporté', 'En livraison', 'problematic', true, false, '00000000-0000-0000-0000-000000000102', 3, now())
on conflict (sendit_order_id) do nothing;

insert into message_templates (status, language, title, message, active) values
  ('Refusé', 'darija', 'Refus / annulation avec offre', 'Salam, la commande dyalkom t''annulat / trefusat. Ila mazal bghitoha, nqadro n3awdo nsefthoha likom b offre nqssa 35dh men taman. Ila bghitoha nconfirmiwha likom daba.', true),
  ('Annulé', 'darija', 'Refus / annulation avec offre', 'Salam, la commande dyalkom t''annulat / trefusat. Ila mazal bghitoha, nqadro n3awdo nsefthoha likom b offre nqssa 35dh men taman. Ila bghitoha nconfirmiwha likom daba.', true),
  ('Injoignable', 'darija', 'Client injoignable', 'Salam, livreur 7awel ytassel bikom bach yssellem likom la commande walakin makanch jawb. Wach t9dro tconfirmiw lina waqt li ynassbkom bach n3awdo nbarmajo livraison?', true),
  ('Retourné', 'darija', 'Retour a sauver', 'Salam, la commande dyalkom raj3at 7it ma tssellmatch. Ila mazal bghitoha, nqadro n3awdo nsefthoha likom f livraison jaya. Ghir confirmiw lina l''adresse w wa9t li ynassbkom.', true),
  ('Reporté', 'darija', 'Confirmation report', 'Salam, bghina nconfirmiw m3akom waqt livraison. Wach mazal bghito la commande? Ila ah, 3tiwna waqt li ynassbkom.', true),
  ('Adresse incorrecte', 'darija', 'Adresse incorrecte', 'Salam, kayn mochkil f l''adresse dyal livraison. 3afakom sendiw lina l''adresse s7i7a bach n3awdo nbarmajo livraison.', true),
  ('Refusé', 'french', 'Refus / annulation avec offre', 'Bonjour, votre commande a ete annulee ou refusee. Si vous la souhaitez toujours, nous pouvons la renvoyer avec une offre de 35 MAD de reduction. Confirmez-nous et nous la relancons.', true),
  ('Annulé', 'french', 'Refus / annulation avec offre', 'Bonjour, votre commande a ete annulee ou refusee. Si vous la souhaitez toujours, nous pouvons la renvoyer avec une offre de 35 MAD de reduction. Confirmez-nous et nous la relancons.', true),
  ('Injoignable', 'french', 'Client injoignable', 'Bonjour, le livreur a essaye de vous joindre pour livrer votre commande, mais il n''a pas eu de reponse. Pouvez-vous confirmer le creneau qui vous convient pour reprogrammer la livraison ?', true),
  ('Retourné', 'french', 'Retour a sauver', 'Bonjour, votre commande est retournee car elle n''a pas ete livree. Si vous la souhaitez toujours, nous pouvons la renvoyer lors de la prochaine livraison. Merci de confirmer l''adresse et le creneau.', true),
  ('Reporté', 'french', 'Confirmation report', 'Bonjour, nous souhaitons confirmer le creneau de livraison. Souhaitez-vous toujours la commande ? Si oui, merci de nous indiquer le moment qui vous convient.', true),
  ('Adresse incorrecte', 'french', 'Adresse incorrecte', 'Bonjour, il y a un probleme avec l''adresse de livraison. Merci de nous envoyer l''adresse correcte pour reprogrammer la livraison.', true),
  ('Téléphone incorrect', 'darija', 'Telephone incorrect', 'Salam, kayn mochkil f numero telephone dyal la commande. 3afakom sendiw lina numero s7i7 bach livreur y9der ytassel bikom.', true),
  ('Téléphone incorrect', 'french', 'Telephone incorrect', 'Bonjour, le numero de telephone de la commande semble incorrect. Merci de nous envoyer le bon numero pour que le livreur puisse vous joindre.', true),
  ('En retard', 'darija', 'Commande en retard', 'Salam, sm7o lina 3la retard dyal la commande. Wach t9dro tconfirmiw lina ila mazal bghitoha w waqt li ynassbkom?', true),
  ('En retard', 'french', 'Commande en retard', 'Bonjour, desoles pour le retard de votre commande. Pouvez-vous confirmer si vous la souhaitez toujours et le creneau qui vous convient ?', true)
on conflict do nothing;
