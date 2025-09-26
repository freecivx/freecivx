/***********************************************************************
 Freeciv - Copyright (C) 1996 - A Kjeldberg, L Gregersen, P Unold
   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; either version 2, or (at your option)
   any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.
***********************************************************************/

#ifdef HAVE_CONFIG_H
#include <fc_config.h>
#endif

// Qt
#include <QCheckBox>
#include <QGridLayout>
#include <QLineEdit>
#include <QListWidget>
#include <QMenu>
#include <QPushButton>
#include <QToolButton>

// utility
#include "fcintl.h"
#include "log.h"

// common
#include "game.h"
#include "unittype.h"

// ruledit
#include "edit_utype.h"
#include "ruledit.h"
#include "ruledit_qt.h"
#include "validity.h"

#include "tab_unit.h"

/**********************************************************************//**
  Setup tab_unit object
**************************************************************************/
tab_unit::tab_unit(ruledit_gui *ui_in) : QWidget()
{
  QVBoxLayout *main_layout = new QVBoxLayout(this);
  QGridLayout *unit_layout = new QGridLayout();
  QLabel *label;
  QPushButton *button;
  int but_row = 0;

  ui = ui_in;
  selected = 0;

  unit_list = new QListWidget(this);

  connect(unit_list, SIGNAL(itemSelectionChanged()), this, SLOT(select_unit()));
  main_layout->addWidget(unit_list);

  unit_layout->setSizeConstraint(QLayout::SetMaximumSize);

  label = new QLabel(QString::fromUtf8(R__("Rule Name")));
  label->setParent(this);
  rname = new QLineEdit(this);
  rname->setText(R__("None"));
  connect(rname, SIGNAL(returnPressed()), this, SLOT(name_given()));
  unit_layout->addWidget(label, but_row, 0);
  unit_layout->addWidget(rname, but_row++, 2);

  label = new QLabel(QString::fromUtf8(R__("Name")));
  label->setParent(this);
  same_name = new QCheckBox();
  connect(same_name, SIGNAL(toggled(bool)), this, SLOT(same_name_toggle(bool)));
  name = new QLineEdit(this);
  name->setText(R__("None"));
  connect(name, SIGNAL(returnPressed()), this, SLOT(name_given()));
  unit_layout->addWidget(label, but_row, 0);
  unit_layout->addWidget(same_name, but_row, 1);
  unit_layout->addWidget(name, but_row++, 2);

  button = new QPushButton(QString::fromUtf8(R__("Edit Values")), this);
  connect(button, SIGNAL(pressed()), this, SLOT(edit_now()));
  unit_layout->addWidget(button, but_row++, 2);

  button = new QPushButton(QString::fromUtf8(R__("Requirements")), this);
  connect(button, SIGNAL(pressed()), this, SLOT(edit_reqs()));
  unit_layout->addWidget(button, but_row++, 2);

  button = new QPushButton(QString::fromUtf8(R__("Effects")), this);
  connect(button, SIGNAL(pressed()), this, SLOT(edit_effects()));
  unit_layout->addWidget(button, but_row++, 2);

  button = new QPushButton(QString::fromUtf8(R__("Add Unit")), this);
  connect(button, SIGNAL(pressed()), this, SLOT(add_now()));
  unit_layout->addWidget(button, but_row, 0);
  show_experimental(button);

  button = new QPushButton(QString::fromUtf8(R__("Remove this Unit")), this);
  connect(button, SIGNAL(pressed()), this, SLOT(delete_now()));
  unit_layout->addWidget(button, but_row++, 2);
  show_experimental(button);

  refresh();
  update_utype_info(nullptr);

  main_layout->addLayout(unit_layout);

  setLayout(main_layout);
}

/**********************************************************************//**
  Refresh the information.
**************************************************************************/
void tab_unit::refresh()
{
  unit_list->clear();

  unit_type_iterate(ptype) {
    if (!ptype->ruledit_disabled) {
      QListWidgetItem *item = new QListWidgetItem(utype_rule_name(ptype));

      unit_list->insertItem(utype_index(ptype), item);
    }
  } unit_type_iterate_end;
}

/**********************************************************************//**
  Update info of the unit
**************************************************************************/
void tab_unit::update_utype_info(struct unit_type *ptype)
{
  selected = ptype;

  if (selected != nullptr) {
    QString dispn = QString::fromUtf8(untranslated_name(&(ptype->name)));
    QString rulen = QString::fromUtf8(utype_rule_name(ptype));

    name->setText(dispn);
    rname->setText(rulen);
    if (dispn == rulen) {
      name->setEnabled(false);
      same_name->setChecked(true);
    } else {
      same_name->setChecked(false);
      name->setEnabled(true);
    }
  } else {
    name->setText(R__("None"));
    rname->setText(R__("None"));
    same_name->setChecked(true);
    name->setEnabled(false);
  }
}

/**********************************************************************//**
  User selected unit from the list.
**************************************************************************/
void tab_unit::select_unit()
{
  QList<QListWidgetItem *> select_list = unit_list->selectedItems();

  if (!select_list.isEmpty()) {
    QByteArray un_bytes;

    un_bytes = select_list.at(0)->text().toUtf8();
    update_utype_info(unit_type_by_rule_name(un_bytes.data()));
  }
}

/**********************************************************************//**
  User entered name for the unit
**************************************************************************/
void tab_unit::name_given()
{
  if (selected != nullptr) {
    QByteArray name_bytes;
    QByteArray rname_bytes;

    unit_type_iterate(ptype) {
      if (ptype != selected && !ptype->ruledit_disabled) {
        rname_bytes = rname->text().toUtf8();
        if (!strcmp(utype_rule_name(ptype), rname_bytes.data())) {
          ui->display_msg(R__("A unit type with that rule name already "
                              "exists!"));
          return;
        }
      }
    } unit_type_iterate_end;

    if (same_name->isChecked()) {
      name->setText(rname->text());
    }

    name_bytes = name->text().toUtf8();
    rname_bytes = rname->text().toUtf8();
    names_set(&(selected->name), 0,
              name_bytes.data(),
              rname_bytes.data());
    refresh();
  }
}

/**********************************************************************//**
  User requested unit deletion 
**************************************************************************/
void tab_unit::delete_now()
{
  if (selected != nullptr) {
    requirers_dlg *requirers;

    requirers = ui->create_requirers(utype_rule_name(selected));
    if (is_utype_needed(selected, &ruledit_qt_display_requirers, requirers)) {
      return;
    }

    selected->ruledit_disabled = true;

    if (selected->ruledit_dlg != nullptr) {
      ((edit_utype *)selected->ruledit_dlg)->done(0);
    }

    refresh();
    update_utype_info(nullptr);
  }
}

/**********************************************************************//**
  User requested unit edit dialog
**************************************************************************/
void tab_unit::edit_now()
{
  if (selected != nullptr) {
    if (selected->ruledit_dlg == nullptr) {
      edit_utype *edit = new edit_utype(ui, selected);

      edit->show();
      selected->ruledit_dlg = edit;
    } else {
      ((edit_utype *)selected->ruledit_dlg)->raise();
    }
  }
}

/**********************************************************************//**
  Initialize new tech for use.
**************************************************************************/
bool tab_unit::initialize_new_utype(struct unit_type *ptype)
{
  if (unit_type_by_rule_name("New Unit") != nullptr) {
    return false;
  }

  name_set(&(ptype->name), 0, "New Unit");
  return true;
}

/**********************************************************************//**
  User requested new unit
**************************************************************************/
void tab_unit::add_now()
{
  struct unit_type *new_utype;

  // Try to reuse freed utype slot
  unit_type_iterate(ptype) {
    if (ptype->ruledit_disabled) {
      if (initialize_new_utype(ptype)) {
        ptype->ruledit_disabled = false;
        update_utype_info(ptype);
        refresh();
      }
      return;
    }
  } unit_type_iterate_end;

  // Try to add completely new unit type
  if (game.control.num_unit_types >= U_LAST) {
    return;
  }

  // num_unit_types must be big enough to hold new unit or
  // utype_by_number() fails.
  game.control.num_unit_types++;
  new_utype = utype_by_number(game.control.num_unit_types - 1);
  if (initialize_new_utype(new_utype)) {
    update_utype_info(new_utype);

    refresh();
  } else {
    game.control.num_unit_types--; // Restore
  }
}

/**********************************************************************//**
  Toggled whether rule_name and name should be kept identical
**************************************************************************/
void tab_unit::same_name_toggle(bool checked)
{
  name->setEnabled(!checked);
  if (checked) {
    name->setText(rname->text());
  }
}

/**********************************************************************//**
  User wants to edit reqs
**************************************************************************/
void tab_unit::edit_reqs()
{
  if (selected != nullptr) {
    ui->open_req_edit(QString::fromUtf8(utype_rule_name(selected)),
                      &selected->build_reqs);
  }
}

/**********************************************************************//**
  User wants to edit effects
**************************************************************************/
void tab_unit::edit_effects()
{
  if (selected != nullptr) {
    struct universal uni;

    uni.value.utype = selected;
    uni.kind = VUT_UTYPE;

    ui->open_effect_edit(QString::fromUtf8(utype_rule_name(selected)),
                         &uni, EFMC_NORMAL);
  }
}
