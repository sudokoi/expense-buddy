# Public Seed Sources

This note tracks public-source candidates reviewed for expanding the SMS ML seed set.

## Conclusion

- there are not enough clearly reusable, direct transaction-SMS corpora to rely on public SMS alone
- the practical path is a hybrid one:
  - small direct SMS sources with acceptable reuse terms
  - public adjacent merchant and transaction-description datasets for category structure
  - curated internal review over anonymized real SMS samples

## Reviewed candidates

### Direct or near-direct SMS sources

- Bank Transactions SMS datasets
  - URL: https://www.kaggle.com/datasets/engreemali/bank-transactions-sms-datasetss
  - Contains: public bank transaction SMS records in spreadsheet form
  - Reuse status: unsuitable for automatic intake until rights are reviewed; the page indicates commercial use is restricted
  - Notes: content is directly relevant, but legal clarity is weak

- BERT-NER-Bank-Transactions
  - URL: https://github.com/imanjunathn/BERT-NER-Bank-Transactions
  - Contains: MIT-licensed NER code and notebook examples for bank transaction SMS
  - Reuse status: partially suitable
  - Notes: useful for schema ideas and example SMS text, but the full dataset is not self-contained in the repo

- transaction-sms-parser
  - URL: https://github.com/saurabhgupta050890/transaction-sms-parser
  - Contains: MIT-licensed parser logic and example transaction SMS fixtures/workflow
  - Reuse status: partially suitable
  - Notes: good for parser patterns and a fixture format, but not a substantial ready-made corpus

- Sika / PennyWatch
  - URL: https://github.com/adjoazzz/sika
  - Contains: MIT-licensed mobile-money and bank SMS examples across African providers
  - Reuse status: partially suitable
  - Notes: valuable as diverse message-format seeds, but too small to act as the main dataset

### Adjacent category and merchant datasets

- transaction-categorization
  - URL: https://huggingface.co/datasets/mitulshah/transaction-categorization
  - Contains: large merchant-description to category dataset
  - Reuse status: partially suitable
  - Notes: strong adjacent source for merchant/category learning, but not SMS text

- mcc-codes
  - URL: https://github.com/greggles/mcc-codes
  - Contains: merchant category code taxonomy files under the Unlicense
  - Reuse status: suitable as taxonomy support
  - Notes: useful for category normalization and mapping policy, not for message text

- BANKING77
  - URL: https://huggingface.co/datasets/PolyAI/banking77
  - Contains: banking-support utterances labeled by intent
  - Reuse status: partially suitable
  - Notes: helpful for banking language coverage, but not transaction alerts or expense categories

## Intake guidance

- do not auto-import any public SMS corpus into the training set without checking reuse rights and message sensitivity first
- prefer small, clearly licensed example corpora for fixture expansion and parser regression coverage
- use adjacent public datasets to bootstrap merchant-category priors, not as a substitute for reviewed SMS labels