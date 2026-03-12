from pydantic import BaseModel
from typing import Dict, Any, List

class AnalysisResult(BaseModel):
    # New Standard Fields (Requested)
    approved: bool
    final_score: float
    quality_label: str
    reasons: List[str]
    metrics: Dict[str, Any]
    
    # Backward Compatibility Fields (Existing Node.js Backend & TS frontend format)
    score: float
    minScore: float
    status: str
    blurScore: float
    brightness: float
    textDetected: bool
    usefulAreaPct: float
    recommendation: str
    thresholds: Dict[str, Any]
