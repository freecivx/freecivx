/********************************************************************** 
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

#ifndef FC__REQUIRERS_DLG_H
#define FC__REQUIRERS_DLG_H

#ifdef HAVE_CONFIG_H
#include <fc_config.h>
#endif

// Qt
#include <QDialog>
#include <QTextEdit>

class ruledit_gui;

class requirers_dlg : public QDialog
{
  Q_OBJECT

  public:
    explicit requirers_dlg(ruledit_gui *ui_in);
    void clear(const char *title);
    void add(const char *msg);

  private:
    ruledit_gui *ui;

    QTextEdit *area;

  private slots:
    void close_now();
};


#endif // FC__REQUIRERS_DIALOG_H
