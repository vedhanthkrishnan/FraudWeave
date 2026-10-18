"""Train a local historical-label baseline; no raw data or artifact is published."""
from datetime import datetime, timezone
from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (average_precision_score, precision_recall_curve,
                             precision_recall_fscore_support, confusion_matrix,
                             roc_auc_score)
from threadpoolctl import threadpool_limits

ROOT = Path(__file__).resolve().parents[2]


def main():
    folder = ROOT / 'data/raw/elliptic_bitcoin_dataset'
    labels = pd.read_csv(folder / 'elliptic_txs_classes.csv', dtype={'txId': str})
    features = pd.read_csv(folder / 'elliptic_txs_features.csv', header=None, dtype={0: str})
    frame = features.merge(labels, left_on=0, right_on='txId', validate='one_to_one')
    frame = frame[frame['class'].isin(['1', '2'])].copy()
    x = frame.loc[:, list(range(2, 167))].to_numpy(dtype=np.float64)
    y = (frame['class'] == '1').to_numpy(dtype=int)
    steps = frame[1].to_numpy()
    train, validation, test = steps <= 34, (steps >= 35) & (steps <= 39), steps >= 40
    for name, mask in [('train', train), ('validation', validation), ('test', test)]:
        if len(np.unique(y[mask])) != 2:
            raise ValueError(f'{name} partition must contain both research labels')
    classifier = HistGradientBoostingClassifier(
        max_iter=120, max_leaf_nodes=15, learning_rate=0.08,
        l2_regularization=2.0, class_weight='balanced', early_stopping=False,
        random_state=42,
    )
    print('Training on time steps 1–34; validation 35–39; final holdout 40–49.', flush=True)
    with threadpool_limits(limits=2):
        classifier.fit(x[train], y[train])
        validation_scores = classifier.predict_proba(x[validation])[:, 1]
        precision, recall, thresholds = precision_recall_curve(y[validation], validation_scores)
        f1 = 2 * precision[:-1] * recall[:-1] / np.maximum(precision[:-1] + recall[:-1], 1e-12)
        threshold = float(thresholds[int(np.argmax(f1))])
        scores = classifier.predict_proba(x[test])[:, 1]
    predicted = (scores >= threshold).astype(int)
    p, r, f, _ = precision_recall_fscore_support(y[test], predicted, average='binary', zero_division=0)
    metadata = {
        'version': 'elliptic-hgb-v1', 'algorithm': 'HistGradientBoostingClassifier',
        'trained_at': datetime.now(timezone.utc).isoformat(),
        'feature_count': 165, 'threshold': threshold,
        'split': {'train': '1–34', 'validation': '35–39', 'test': '40–49'},
        'partitions': {name: {'records': int(mask.sum()), 'illicit_labelled': int(y[mask].sum())}
                       for name, mask in [('train', train), ('validation', validation), ('test', test)]},
        'test_metrics': {'precision': float(p), 'recall': float(r), 'f1': float(f),
                         'average_precision': float(average_precision_score(y[test], scores)),
                         'roc_auc': float(roc_auc_score(y[test], scores)),
                         'confusion_matrix': confusion_matrix(y[test], predicted, labels=[0, 1]).tolist()},
        'limitations': [
            'Predicts historical research labels; not wrongdoing or a calibrated fraud probability.',
            'Evaluated only on labelled records, not the unknown-label population.',
            'Anonymized aggregate features and historical distribution limit real-world generalization.',
            'Records in steps 1–34 were used for training; their scores are in-sample.',
        ],
    }
    output = ROOT / 'models'
    output.mkdir(exist_ok=True)
    joblib.dump({'classifier': classifier, 'metadata': metadata}, output / 'baseline.joblib', compress=3)
    (output / 'metrics.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(metadata, indent=2), flush=True)


if __name__ == '__main__':
    main()
