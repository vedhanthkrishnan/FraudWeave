from functools import lru_cache
from pathlib import Path
import math
import joblib
import numpy as np
from threadpoolctl import threadpool_limits

MODEL_PATH = Path(__file__).resolve().parents[2] / 'models/baseline.joblib'


@lru_cache(maxsize=2)
def load_model(modified):
    # Only load the locally trained artifact at this fixed path, never uploaded files.
    return joblib.load(MODEL_PATH)


def model_status():
    if not MODEL_PATH.exists():
        return {'available': False, 'reason': 'Run python -m src.ml.train after obtaining the original dataset.'}
    artifact = load_model(MODEL_PATH.stat().st_mtime_ns)
    return {'available': True, **artifact['metadata']}


def predict(properties):
    if not MODEL_PATH.exists():
        return model_status()
    values = [properties.get(f'f{i:03d}') for i in range(165)]
    if any(not isinstance(value, (float, int)) or not math.isfinite(value) for value in values):
        return {'available': False, 'reason': 'All 165 finite numerical features are required.'}
    artifact = load_model(MODEL_PATH.stat().st_mtime_ns)
    metadata = artifact['metadata']
    with threadpool_limits(limits=2):
        score = float(artifact['classifier'].predict_proba(np.array([values], dtype=float))[0, 1])
    step = int(properties.get('time_step', 0))
    split = 'unlabelled / not evaluated'
    if properties.get('label') in ('licit_labelled', 'illicit_labelled'):
        split = 'training / in-sample' if step <= 34 else 'validation' if step <= 39 else 'test holdout'
    return {'available': True, 'version': metadata['version'], 'score': round(score, 6),
            'threshold': metadata['threshold'], 'predicted_label': 'illicit_labelled' if score >= metadata['threshold'] else 'licit_labelled',
            'evaluation_context': split, 'note': metadata['limitations'][0]}
