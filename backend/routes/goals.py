import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models.fund_category import FundCategory
from models.goal import Goal, GoalAllocation
from models.user import User
from schemas.goal import GoalAllocationCreate, GoalAllocationOut, GoalCreate, GoalOut, GoalUpdate

router = APIRouter(prefix="/goals", tags=["goals"])


def _get_owned_goal(db: Session, goal_id: uuid.UUID, current_user: User) -> Goal:
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == current_user.id).first()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.get("", response_model=list[GoalOut])
def list_goals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Goal).filter(Goal.user_id == current_user.id).order_by(Goal.created_at).all()


@router.post("", response_model=GoalOut, status_code=201)
def create_goal(
    payload: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = Goal(**payload.model_dump(), user_id=current_user.id)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.patch("/{goal_id}", response_model=GoalOut)
def update_goal(
    goal_id: uuid.UUID,
    payload: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = _get_owned_goal(db, goal_id, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=204)
def delete_goal(
    goal_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Its allocations go with it; expenses linked to it just lose the link.
    db.delete(_get_owned_goal(db, goal_id, current_user))
    db.commit()


@router.post("/{goal_id}/allocations", response_model=GoalAllocationOut, status_code=201)
def add_allocation(
    goal_id: uuid.UUID,
    payload: GoalAllocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = _get_owned_goal(db, goal_id, current_user)
    if payload.amount == 0:
        raise HTTPException(status_code=422, detail="Amount can't be zero")
    fund = (
        db.query(FundCategory)
        .filter(FundCategory.id == payload.fund_category_id, FundCategory.user_id == current_user.id)
        .first()
    )
    if fund is None:
        raise HTTPException(status_code=404, detail="Fund category not found")
    allocation = GoalAllocation(goal_id=goal.id, **payload.model_dump())
    db.add(allocation)
    db.commit()
    db.refresh(allocation)
    return allocation


@router.delete("/{goal_id}/allocations/{allocation_id}", status_code=204)
def delete_allocation(
    goal_id: uuid.UUID,
    allocation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = _get_owned_goal(db, goal_id, current_user)
    allocation = (
        db.query(GoalAllocation)
        .filter(GoalAllocation.id == allocation_id, GoalAllocation.goal_id == goal.id)
        .first()
    )
    if allocation is None:
        raise HTTPException(status_code=404, detail="Allocation not found")
    db.delete(allocation)
    db.commit()
