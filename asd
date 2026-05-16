                                                                     Table "public.bids"
    Column    |           Type           | Collation | Nullable |               Default                | Storage  | Compression | Stats target | Description 
--------------+--------------------------+-----------+----------+--------------------------------------+----------+-------------+--------------+-------------
 bid_id       | integer                  |           | not null | nextval('bids_bid_id_seq'::regclass) | plain    |             |              | 
 question_id  | integer                  |           | not null |                                      | plain    |             |              | 
 tutor_id     | integer                  |           | not null |                                      | plain    |             |              | 
 price        | real                     |           | not null |                                      | plain    |             |              | 
 message      | text                     |           | not null |                                      | extended |             |              | 
 status       | text                     |           | not null | 'Pending'::text                      | extended |             |              | 
 created_date | timestamp with time zone |           | not null | now()                                | plain    |             |              | 
Indexes:
    "bids_pkey" PRIMARY KEY, btree (bid_id)
Foreign-key constraints:
    "bids_question_id_questions_question_id_fk" FOREIGN KEY (question_id) REFERENCES questions(question_id)
    "bids_tutor_id_users_user_id_fk" FOREIGN KEY (tutor_id) REFERENCES users(user_id)
Access method: heap

